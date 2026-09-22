"""
Making the dialogue in a movie clip easier to hear.

Clips cut straight out of a film are quiet and inconsistent: measured across a
sample of this collection they range from about -25 to -54 LUFS, a ~29 dB
spread, and the dialogue often sits under music or room noise. This module
builds the ffmpeg filter chain that fixes both, and runs the two-pass
`loudnorm` measurement it needs.

Every stage is amplitude- or spectrum-domain only: gain, EQ, spectral
subtraction. None of them resample, time-stretch or pitch-shift, so the F0
contour that carries Mandarin tone comes out of the chain exactly as it went
in. That constraint is why the chain uses `loudnorm`/`speechnorm` rather than
anything built on `rubberband` or `asetrate`, and why the high-pass sits at
80 Hz - below the fundamental of a low male voice, so no tone-bearing energy is
touched.

The presets, weakest to strongest:

    none      No processing at all. The default, so nothing here applies
              unless a caller asks for it by name.
    level     High-pass + loudness normalization. Only changes level.
    speech    Adds gentle denoising, a presence boost for consonants, and a
              light leveler for quiet syllables. The best-behaved of the three
              that process, and what `fill_anki_auto.sh` asks for.
    clarity   Stronger denoising, plus a low-mid cut to pull the voice out from
              under music. Best SNR, most likely to sound processed.

The gain goes on at the front of the chain rather than the back. The denoiser's
thresholds are absolute dBFS, so applying them to the film's own level - a ~29 dB
spread across this collection - subtracted a different amount from every clip,
and the ones that got too much came out sounding robotic. Normalizing first
makes one setting mean one thing. loudnorm still runs last, so the output level
and the true-peak ceiling are still guaranteed.
"""

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

# Loudness target for the finished clip. The rest of this collection's audio
# measures roughly -13 to -26 LUFS, so -18 sits in the middle of it. The target
# is also low enough that speech, whose crest factor runs 14-17 dB, can reach it
# without the true-peak ceiling clamping the gain.
DEFAULT_TARGET_LUFS = -18.0

# True-peak ceiling, in dBTP. The 1.5 dB of headroom absorbs the overshoot that
# MP3 encoding adds on top of the normalized signal.
DEFAULT_TRUE_PEAK_DBTP = -1.5

# Ceiling on the total gain applied to a clip, in dB. Near-silent clips exist
# (one sample measured -54 LUFS, needing +36 dB to reach the target), and
# lifting those all the way just makes their noise floor loud. Such a clip
# stays under the target instead.
DEFAULT_MAX_GAIN_DB = 30.0

# Reference loudness range for loudnorm. Clips this short usually measure an LRA
# of 0, so this mostly just has to be a sane value.
TARGET_LRA = 11.0

# Output sample rate. loudnorm runs its internals at 192 kHz, so without this
# the MP3 would be encoded at that rate.
OUTPUT_SAMPLE_RATE = 44100

# Below this loudness a clip is treated as silent and left alone: loudnorm's
# absolute gate is -70 LUFS, and anything near it has no dialogue to normalize.
SILENCE_LUFS = -69.0

# afftdn delays its output and does not compensate for it. Measured at 25.00 ms
# at 16, 44.1 and 48 kHz, so it is a fixed time rather than a sample count. Left
# alone it would shift every clip late, costing the last 25 ms of dialogue and
# opening the clip on the denoiser's ramp-up; `build_audio_command` reads that
# much extra and trims it back off. The other filters measured as latency-free,
# including loudnorm in both its linear and dynamic modes.
AFFTDN_LATENCY_SECONDS = 0.025

# How much audio to decode ahead of the clip so the adaptive filters enter it
# already converged, rather than settling during the dialogue. afftdn's noise
# tracking needs a few hundred ms to estimate a floor, and speechnorm starts at
# unity gain and ramps in - measured as a 3-5 dB gain step inside the first 20 ms
# on clips that need expansion, audible as a thump at the head. Trimmed back off
# after filtering, and limited by how much source actually precedes the clip.
ADAPTIVE_PREROLL_SECONDS = 0.5

# Filters that carry state across samples, and so need the run-up above.
_ADAPTIVE_FILTERS = ("afftdn", "arnndn", "speechnorm")

# arnndn works a frame at a time and so likely delays its output too, but the
# amount is unverified here - it needs a model file to run at all. An optional,
# opt-in filter being a frame late is not worth guessing a constant for.
ARNNDN_LATENCY_SECONDS = 0.0

_HIGHPASS = "highpass=f=80:poles=2"

# afftdn with noise tracking on. `nr` is the reduction in dB; 10 dB measurably
# lowers the noise floor while leaving the 3-8 kHz band that carries Mandarin
# fricatives and affricates (s, sh, x, c, ch, q) intact. Past ~20 dB it starts
# eating those consonants along with the hiss.
#
# `nf` and `rf` are absolute dBFS, not levels relative to the dialogue, so these
# settings only mean the same thing on every clip because `plan_enhancement`
# gains the clip to the working level before the denoiser sees it. They were
# previously applied to the film's own level, which varies by ~29 dB across this
# collection, so the same preset subtracted a different amount from every clip.
#
# `gs` is what keeps the result from sounding robotic. An FFT denoiser leaves
# "musical noise": isolated bins that survive subtraction and ring as short
# tones. `gs` smooths the gain across neighbouring bins, which suppresses them;
# it is off by default. `rf` holds a floor of the clip's own noise in the output,
# where it masks whatever ringing is left - subtracting all the way down to
# silence between the words is the other half of what sounds artificial.
_DENOISE_GENTLE = "afftdn=nr=10:nf=-40:tn=1:gs=6:rf=-30"
_DENOISE_STRONG = "afftdn=nr=16:nf=-35:tn=1:gs=10:rf=-32"

# A presence boost around 3 kHz, where consonant cues live. This changes the
# relative level of the harmonics, not their frequencies, so tone is unaffected.
_PRESENCE = "equalizer=f=3000:t=q:w=1.2:g=4"
_PRESENCE_STRONG = "equalizer=f=3000:t=q:w=1.2:g=5"

# Cuts the low-mid "mud" where music and room boom mask the voice. Only in
# `clarity`: at -3 dB it is well short of affecting pitch perception, but it does
# sit in the region of a female fundamental, so the default preset leaves it out.
_MUD_CUT = "equalizer=f=250:t=q:w=1.0:g=-3"

# A leveler, not a compressor: `r`/`f` are slow enough that gain moves over
# roughly a second rather than within a syllable, so the intensity envelope of
# an individual syllable survives. `e=3` caps expansion at ~9.5 dB and `t`
# keeps it from lifting the background during pauses.
_LEVELER = "speechnorm=e=3:r=0.00005:f=0.0005:p=0.9:t=0.02:l=1"

PRESETS: dict[str, list[str]] = {
    "none": [],
    "level": [_HIGHPASS],
    "speech": [_HIGHPASS, _DENOISE_GENTLE, _PRESENCE, _LEVELER],
    "clarity": [_HIGHPASS, _DENOISE_STRONG, _MUD_CUT, _PRESENCE_STRONG, _LEVELER],
}

# Processing is opt-in: a caller that says nothing gets the clip's audio as it
# came out of the film. Callers that want it cleaned up ask for a preset by
# name, which keeps the choice visible at the call site rather than buried here.
DEFAULT_PRESET = "none"


class LoudnessMeasurementError(RuntimeError):
    """Raised when loudnorm's analysis pass does not return usable measurements."""


@dataclass(frozen=True)
class SpeechEnhancement:
    """How to process a clip's audio. `preset` of `none` disables everything."""

    preset: str = DEFAULT_PRESET
    target_lufs: float = DEFAULT_TARGET_LUFS
    true_peak_dbtp: float = DEFAULT_TRUE_PEAK_DBTP
    max_gain_db: float = DEFAULT_MAX_GAIN_DB
    rnnoise_model: Path | None = None

    def __post_init__(self) -> None:
        if self.preset not in PRESETS:
            raise ValueError(f"unknown audio preset {self.preset!r}; choose one of {', '.join(PRESETS)}")
        if self.rnnoise_model is not None and not self.rnnoise_model.is_file():
            raise FileNotFoundError(f"rnnoise model not found: {self.rnnoise_model}")

    @property
    def enabled(self) -> bool:
        """Whether this asks for any processing."""
        return self.preset != "none"

    def pre_filters(self, gain_db: float = 0.0) -> list[str]:
        """
        The filters applied before loudness normalization.

        `gain_db` is applied ahead of everything else, so the denoiser and the
        leveler see the clip at the working level rather than at whatever level
        it had in the film.
        """
        filters = list(PRESETS[self.preset])
        if self.rnnoise_model is not None:
            # arnndn is a speech-vs-everything-else model, so it goes after the
            # high-pass but ahead of the EQ that shapes what it leaves behind.
            insert_at = 1 if filters else 0
            filters.insert(insert_at, f"arnndn=m={_escape_filter_value(str(self.rnnoise_model))}")
        if round(gain_db, 2) != 0.0:
            filters.insert(0, f"volume={gain_db:.2f}dB")
        return filters

    def latency_seconds(self) -> float:
        """How far the filters delay their output, to be read ahead and trimmed back off."""
        latency = sum(AFFTDN_LATENCY_SECONDS for f in PRESETS[self.preset] if f.startswith("afftdn"))
        if self.rnnoise_model is not None:
            latency += ARNNDN_LATENCY_SECONDS
        return latency

    def preroll_seconds(self) -> float:
        """How much run-up the stateful filters need, or 0 if this preset has none."""
        if self.rnnoise_model is not None or any(f.startswith(_ADAPTIVE_FILTERS) for f in PRESETS[self.preset]):
            return ADAPTIVE_PREROLL_SECONDS
        return 0.0


@dataclass(frozen=True)
class LoudnessMeasurement:
    """One loudnorm analysis pass, in LUFS/dBTP."""

    input_i: float
    input_tp: float
    input_lra: float
    input_thresh: float
    target_offset: float

    @property
    def is_silent(self) -> bool:
        """Whether the measured audio is too quiet to be dialogue."""
        return self.input_i <= SILENCE_LUFS


def _escape_filter_value(value: str) -> str:
    """Escape a value for use inside an ffmpeg filter argument."""
    for char in ("\\", ":", "'", ",", "[", "]", ";"):
        value = value.replace(char, "\\" + char)
    return value


def _trim_args(start: float, end: float) -> list[str]:
    """Input-seek arguments selecting the [start, end) region of a source."""
    return ["-ss", format_ffmpeg_timestamp(start), "-to", format_ffmpeg_timestamp(end)]


@dataclass(frozen=True)
class ReadWindow:
    """
    The region to decode from the source, and the trim that cuts it back to the clip.

    Stateful filters need a run-up and delay their output, so the region read is
    wider than the clip at both ends: `front_trim` drops the run-up and the delay
    once filtering is done, leaving exactly the region the caller asked for.
    Reading past the source's end is harmless - ffmpeg stops at EOF - but reading
    before its start is not, so the run-up is whatever the source can supply.
    """

    start: float
    end: float
    front_trim: float

    def trim_filters(self) -> list[str]:
        """Filters that drop the leading run-up, or none if there is nothing to drop."""
        if self.front_trim <= 0:
            return []
        return [f"atrim=start={self.front_trim:.6f}", "asetpts=N/SR/TB"]


def _read_window(start: float, end: float, preroll: float, latency: float) -> ReadWindow:
    """Widen [start, end) by the filters' run-up and delay, clamped at the source's start."""
    read_start = max(0.0, start - preroll)
    return ReadWindow(start=read_start, end=end + latency, front_trim=(start - read_start) + latency)


def format_ffmpeg_timestamp(seconds: float) -> str:
    """Format seconds as an ffmpeg-friendly 'HH:MM:SS.mmm' timestamp."""
    total_ms = round(seconds * 1000)
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, ms = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"


def measure_loudness(
    source: Path,
    window: ReadWindow,
    enhancement: SpeechEnhancement,
    pre_filters: list[str] | None = None,
) -> LoudnessMeasurement:
    """
    Run loudnorm's analysis pass over a region of a clip.

    The window's run-up is filtered and then trimmed off before measuring, the
    same way the render does it, so the measurement describes the audio that
    will actually be written rather than a differently-converged copy of it.

    Args:
        source: The video or audio file to measure
        window: The region to measure, and the run-up to filter and discard
        enhancement: Supplies the loudness target the measurement is reported against
        pre_filters: Filters to apply before measuring; defaults to none, so the
            clip is measured as-is

    Returns:
        The measurement, to be fed back into the second pass

    Raises:
        LoudnessMeasurementError: If loudnorm prints no parsable JSON report
    """
    chain = list(pre_filters or [])
    chain += window.trim_filters()
    chain.append(f"loudnorm=I={enhancement.target_lufs}:TP={enhancement.true_peak_dbtp}:LRA={TARGET_LRA}:print_format=json")

    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            *_trim_args(window.start, window.end),
            "-i",
            str(source),
            "-vn",
            "-map",
            "0:a:0?",
            "-af",
            ",".join(chain),
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        check=True,
    )

    report = _parse_loudnorm_json(result.stderr)
    try:
        return LoudnessMeasurement(
            input_i=float(report["input_i"]),
            input_tp=float(report["input_tp"]),
            input_lra=float(report["input_lra"]),
            input_thresh=float(report["input_thresh"]),
            target_offset=float(report["target_offset"]),
        )
    except (KeyError, ValueError) as e:
        raise LoudnessMeasurementError(f"loudnorm report from {source.name} is missing a value: {e}") from e


def _parse_loudnorm_json(stderr: str) -> dict[str, str]:
    """Pull the JSON report loudnorm prints to stderr, which trails other log output."""
    start = stderr.rfind("{")
    end = stderr.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise LoudnessMeasurementError(f"loudnorm printed no JSON report; ffmpeg said: {stderr.strip()[-500:]}")
    try:
        report: dict[str, str] = json.loads(stderr[start : end + 1])
    except json.JSONDecodeError as e:
        raise LoudnessMeasurementError(f"loudnorm printed an unparsable JSON report: {e}") from e
    return report


@dataclass(frozen=True)
class EnhancementPlan:
    """The filter chain for a clip, plus what it will do to the clip's loudness."""

    filters: list[str]
    window: ReadWindow
    original_lufs: float
    output_lufs: float
    gain_db: float
    gain_was_capped: bool

    def describe(self) -> str:
        """A one-line summary for the caller's progress output."""
        capped = f", capped at {self.gain_db:+.1f}" if self.gain_was_capped else ""
        return f"{self.original_lufs:.1f} -> {self.output_lufs:.1f} LUFS ({self.gain_db:+.1f} dB{capped})"


def plan_enhancement(source: Path, start: float, end: float, enhancement: SpeechEnhancement) -> EnhancementPlan | None:
    """
    Measure a clip and build the filter chain that will normalize it.

    This runs two analysis passes: one on the untouched clip, which sets the
    gain the chain applies up front, and one through the preset's filters,
    which is what loudnorm's second pass needs to be accurate.

    Args:
        source: The video or audio file the clip comes from
        start: Offset of the audio to extract, in seconds
        end: End of the audio to extract, in seconds
        enhancement: The preset and targets to apply

    Returns:
        The plan, or None if the clip is silent or processing is disabled

    Raises:
        LoudnessMeasurementError: If either analysis pass fails
    """
    if not enhancement.enabled:
        return None

    original = measure_loudness(source, ReadWindow(start, end, 0.0), enhancement)
    if original.is_silent:
        return None

    # Cap the gain measured against the untouched clip, so the cap covers
    # whatever the leveler already added rather than only loudnorm's share.
    output_lufs = min(enhancement.target_lufs, original.input_i + enhancement.max_gain_db)
    gain_was_capped = output_lufs < enhancement.target_lufs

    # Most of that gain is applied first, ahead of the denoiser, so its absolute
    # thresholds land in the same place on a -25 LUFS clip as on a -54 LUFS one.
    # loudnorm still runs last and still has the final say on the output level,
    # but by then it is correcting what the EQ and the leveler added rather than
    # lifting the clip on its own. A clip that hit the gain cap arrives under the
    # working level, which is the best that can be done without amplifying its
    # noise floor past the point of the cap.
    pre_filters = enhancement.pre_filters(output_lufs - original.input_i)

    window = _read_window(start, end, enhancement.preroll_seconds(), enhancement.latency_seconds())
    processed = measure_loudness(source, window, enhancement, pre_filters)
    if processed.is_silent:
        return None

    loudnorm = (
        f"loudnorm=I={output_lufs:.2f}"
        f":TP={enhancement.true_peak_dbtp}"
        f":LRA={TARGET_LRA}"
        f":measured_I={processed.input_i}"
        f":measured_TP={processed.input_tp}"
        f":measured_LRA={processed.input_lra}"
        f":measured_thresh={processed.input_thresh}"
        f":offset={processed.target_offset}"
        ":linear=true"
    )

    return EnhancementPlan(
        filters=[*pre_filters, *window.trim_filters(), loudnorm],
        window=window,
        original_lufs=original.input_i,
        output_lufs=output_lufs,
        gain_db=output_lufs - original.input_i,
        gain_was_capped=gain_was_capped,
    )


def build_audio_command(source: Path, start: float, end: float, output_path: Path, plan: EnhancementPlan | None) -> list[str]:
    """
    Build the ffmpeg command that writes the clip's audio to an MP3.

    Args:
        source: The video or audio file the clip comes from
        start: Offset of the audio to extract, in seconds
        end: End of the audio to extract, in seconds
        output_path: Where to write the MP3
        plan: The enhancement to apply, or None to extract the audio untouched

    Returns:
        The ffmpeg argument list
    """
    # The plan's window is wider than the clip at both ends, and its filters
    # already carry the trim that cuts the extra back off - see `ReadWindow`.
    window = plan.window if plan is not None else ReadWindow(start, end, 0.0)
    filters: list[str] = list(plan.filters) if plan is not None else []

    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        *_trim_args(window.start, window.end),
        "-i",
        str(source),
        "-vn",
        "-map",
        "0:a:0?",
    ]
    if filters:
        command += ["-af", ",".join(filters), "-ar", str(OUTPUT_SAMPLE_RATE)]
    command += ["-c:a", "libmp3lame", "-q:a", "2", "-ac", "2", "-y", str(output_path)]
    return command

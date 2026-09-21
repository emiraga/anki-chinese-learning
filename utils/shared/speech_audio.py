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

Measured on four sample clips, all normalized to the same loudness so the
numbers are comparable, `speech` lowers the noise floor about 10 dB relative to
the dialogue and `clarity` about 16 dB.
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

# arnndn works a frame at a time and so likely delays its output too, but the
# amount is unverified here - it needs a model file to run at all. An optional,
# opt-in filter being a frame late is not worth guessing a constant for.
ARNNDN_LATENCY_SECONDS = 0.0

_HIGHPASS = "highpass=f=80:poles=2"

# afftdn with noise tracking on. `nr` is the reduction in dB; 12 dB measurably
# lowers the noise floor while leaving the 3-8 kHz band that carries Mandarin
# fricatives and affricates (s, sh, x, c, ch, q) intact. Past ~20 dB it starts
# eating those consonants along with the hiss.
_DENOISE_GENTLE = "afftdn=nr=12:nf=-30:tn=1"
_DENOISE_STRONG = "afftdn=nr=20:nf=-25:tn=1"

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

    def pre_filters(self) -> list[str]:
        """The filters applied before loudness normalization."""
        filters = list(PRESETS[self.preset])
        if self.rnnoise_model is not None:
            # arnndn is a speech-vs-everything-else model, so it goes after the
            # high-pass but ahead of the EQ that shapes what it leaves behind.
            insert_at = 1 if filters else 0
            filters.insert(insert_at, f"arnndn=m={_escape_filter_value(str(self.rnnoise_model))}")
        return filters

    def latency_seconds(self) -> float:
        """How far the filters delay their output, to be read ahead and trimmed back off."""
        latency = sum(AFFTDN_LATENCY_SECONDS for f in PRESETS[self.preset] if f.startswith("afftdn"))
        if self.rnnoise_model is not None:
            latency += ARNNDN_LATENCY_SECONDS
        return latency


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


def format_ffmpeg_timestamp(seconds: float) -> str:
    """Format seconds as an ffmpeg-friendly 'HH:MM:SS.mmm' timestamp."""
    total_ms = round(seconds * 1000)
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, ms = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"


def measure_loudness(
    source: Path,
    start: float,
    end: float,
    enhancement: SpeechEnhancement,
    pre_filters: list[str] | None = None,
) -> LoudnessMeasurement:
    """
    Run loudnorm's analysis pass over a region of a clip.

    Args:
        source: The video or audio file to measure
        start: Offset of the region to measure, in seconds
        end: End of the region to measure, in seconds
        enhancement: Supplies the loudness target the measurement is reported against
        pre_filters: Filters to apply before measuring; defaults to none, so the
            clip is measured as-is

    Returns:
        The measurement, to be fed back into the second pass

    Raises:
        LoudnessMeasurementError: If loudnorm prints no parsable JSON report
    """
    chain = list(pre_filters or [])
    chain.append(f"loudnorm=I={enhancement.target_lufs}:TP={enhancement.true_peak_dbtp}:LRA={TARGET_LRA}:print_format=json")

    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            *_trim_args(start, end),
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
    original_lufs: float
    output_lufs: float
    gain_db: float
    gain_was_capped: bool
    latency_seconds: float

    def describe(self) -> str:
        """A one-line summary for the caller's progress output."""
        capped = f", capped at {self.gain_db:+.1f}" if self.gain_was_capped else ""
        return f"{self.original_lufs:.1f} -> {self.output_lufs:.1f} LUFS ({self.gain_db:+.1f} dB{capped})"


def plan_enhancement(source: Path, start: float, end: float, enhancement: SpeechEnhancement) -> EnhancementPlan | None:
    """
    Measure a clip and build the filter chain that will normalize it.

    This runs two analysis passes: one on the untouched clip, to know the total
    gain the chain is about to apply, and one through the preset's filters,
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

    original = measure_loudness(source, start, end, enhancement)
    if original.is_silent:
        return None

    pre_filters = enhancement.pre_filters()
    processed = measure_loudness(source, start, end, enhancement, pre_filters)
    if processed.is_silent:
        return None

    # Cap the gain measured against the untouched clip, so the cap covers
    # whatever the leveler already added rather than only loudnorm's share.
    output_lufs = min(enhancement.target_lufs, original.input_i + enhancement.max_gain_db)
    gain_was_capped = output_lufs < enhancement.target_lufs

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
        filters=[*pre_filters, loudnorm],
        original_lufs=original.input_i,
        output_lufs=output_lufs,
        gain_db=output_lufs - original.input_i,
        gain_was_capped=gain_was_capped,
        latency_seconds=enhancement.latency_seconds(),
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
    read_end: float = end
    filters: list[str] = []
    if plan is not None:
        # Read past the requested end by the filters' latency, then drop that
        # much from the front, so the clip holds exactly the region asked for
        # rather than the filters' delayed copy of it. Reading past the end of
        # the source is harmless - ffmpeg stops at EOF, leaving the clip short
        # by up to the latency, which is well inside the caller's tolerance.
        read_end = end + plan.latency_seconds
        filters = list(plan.filters)
        if plan.latency_seconds > 0:
            filters += [f"atrim=start={plan.latency_seconds}", "asetpts=N/SR/TB"]

    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        *_trim_args(start, read_end),
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

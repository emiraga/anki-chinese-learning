import { performYinAnalysis } from "./yinAlgorithm";
import { FFT_SIZE, BUFFER_SIZE } from "./constants";
import type { PitchFrame, YinParams } from "./pitchProcessing";

export interface AudioProcessingResult {
  spectrogramData: number[][];
  yinData: PitchFrame[];
}

/**
 * Generate spectrogram data from an audio buffer
 */
export async function generateSpectrogram(audioBuffer: AudioBuffer): Promise<number[][]> {
  return new Promise((resolve, reject) => {
    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    const analyser = offlineCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0;

    const bufferSize = BUFFER_SIZE;
    const processor = offlineCtx.createScriptProcessor(bufferSize, 1, 1);

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const spectrogramData: Uint8Array[] = [];

    processor.onaudioprocess = () => {
      analyser.getByteFrequencyData(freqData);
      spectrogramData.push(new Uint8Array(freqData));
    };

    source.connect(analyser);
    analyser.connect(processor);
    processor.connect(offlineCtx.destination);

    source.start(0);

    offlineCtx
      .startRendering()
      .then(() => {
        // Convert Uint8Array[] to number[][]
        const converted = spectrogramData.map((arr) => Array.from(arr));
        resolve(converted);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

/**
 * Process an audio buffer and generate both spectrogram and YIN pitch data
 */
export async function processAudioBuffer(
  audioBuffer: AudioBuffer,
  yinParams: YinParams
): Promise<AudioProcessingResult> {
  // Perform YIN analysis
  const yinData = performYinAnalysis(audioBuffer, yinParams);

  // Generate spectrogram
  const spectrogramData = await generateSpectrogram(audioBuffer);

  return {
    spectrogramData,
    yinData,
  };
}

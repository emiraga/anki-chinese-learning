/**
 * Convert AudioBuffer to WAV format
 */
export function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numberOfChannels * 2;
  const sampleRate = audioBuffer.sampleRate;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  // Write WAV header
  const writeString = (offset: number, string: string): void => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length, true);

  // Write audio data
  const channels: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Download audio buffer as WAV file
 */
export function downloadAudioBuffer(audioBuffer: AudioBuffer): void {
  const wavBlob = audioBufferToWav(audioBuffer);
  const url = URL.createObjectURL(wavBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tone_recording_${Date.now()}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface TrimSilenceOptions {
  /**
   * Amplitude threshold below which audio is considered silence (0 to 1)
   * @default 0.01
   */
  threshold?: number;

  /**
   * Minimum padding to keep at the beginning in seconds
   * @default 0.05
   */
  paddingStart?: number;

  /**
   * Minimum padding to keep at the end in seconds
   * @default 0.15
   */
  paddingEnd?: number;

  /**
   * Window size in samples for averaging amplitude when detecting silence
   * Helps avoid cutting on brief dips below threshold
   * @default 100
   */
  windowSize?: number;
}

/**
 * Calculate the root mean square (RMS) amplitude of a window of samples
 */
function calculateRMS(data: Float32Array, start: number, length: number): number {
  let sum = 0;
  const end = Math.min(start + length, data.length);
  const actualLength = end - start;

  for (let i = start; i < end; i++) {
    sum += data[i] * data[i];
  }

  return Math.sqrt(sum / actualLength);
}

/**
 * Find the first sample index where audio exceeds the threshold
 */
function findAudioStart(
  channelData: Float32Array,
  threshold: number,
  windowSize: number
): number {
  for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
    const rms = calculateRMS(channelData, i, windowSize);
    if (rms > threshold) {
      // Back up to find the actual start within this window
      for (let j = i; j < i + windowSize && j < channelData.length; j++) {
        if (Math.abs(channelData[j]) > threshold) {
          return j;
        }
      }
      return i;
    }
  }
  return 0;
}

/**
 * Find the last sample index where audio exceeds the threshold
 */
function findAudioEnd(
  channelData: Float32Array,
  threshold: number,
  windowSize: number
): number {
  for (let i = channelData.length - windowSize; i >= 0; i -= windowSize) {
    const rms = calculateRMS(channelData, i, windowSize);
    if (rms > threshold) {
      // Search forward to find the actual end within this window
      for (
        let j = i + windowSize - 1;
        j >= i && j >= 0;
        j--
      ) {
        if (Math.abs(channelData[j]) > threshold) {
          return j;
        }
      }
      return i + windowSize - 1;
    }
  }
  return channelData.length - 1;
}

/**
 * Trim silence from the beginning and end of an audio buffer
 *
 * @param audioBuffer - The audio buffer to trim
 * @param options - Trimming options
 * @returns A new audio buffer with silence trimmed
 *
 * @example
 * ```typescript
 * const trimmed = trimSilence(audioBuffer);
 * const trimmedCustom = trimSilence(audioBuffer, {
 *   threshold: 0.02,
 *   paddingStart: 0.1,
 *   paddingEnd: 0.1,
 * });
 * ```
 */
export function trimSilence(
  audioBuffer: AudioBuffer,
  options: TrimSilenceOptions = {}
): AudioBuffer {
  const {
    threshold = 0.01,
    paddingStart = 0.05,
    paddingEnd = 0.15,
    windowSize = 100,
  } = options;

  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;

  // Find start and end points by analyzing all channels
  let globalStart = audioBuffer.length;
  let globalEnd = 0;

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    const start = findAudioStart(channelData, threshold, windowSize);
    const end = findAudioEnd(channelData, threshold, windowSize);

    globalStart = Math.min(globalStart, start);
    globalEnd = Math.max(globalEnd, end);
  }

  // Apply padding
  const paddingStartSamples = Math.floor(paddingStart * sampleRate);
  const paddingEndSamples = Math.floor(paddingEnd * sampleRate);

  globalStart = Math.max(0, globalStart - paddingStartSamples);
  globalEnd = Math.min(
    audioBuffer.length - 1,
    globalEnd + paddingEndSamples
  );

  // Ensure we have at least some audio
  if (globalStart >= globalEnd) {
    throw new Error("No audio content found above threshold");
  }

  const trimmedLength = globalEnd - globalStart + 1;

  // Create new buffer with trimmed audio
  const trimmedBuffer = new AudioBuffer({
    length: trimmedLength,
    numberOfChannels: numberOfChannels,
    sampleRate: sampleRate,
  });

  // Copy trimmed data for all channels
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const sourceData = audioBuffer.getChannelData(channel);
    const targetData = trimmedBuffer.getChannelData(channel);

    for (let i = 0; i < trimmedLength; i++) {
      targetData[i] = sourceData[globalStart + i];
    }
  }

  return trimmedBuffer;
}

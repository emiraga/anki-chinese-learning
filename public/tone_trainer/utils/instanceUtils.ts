import type { AudioInstance, CreateAudioInstanceOptions } from "../types/audio_instance";
import type { YinParams } from "./pitchProcessing";

/**
 * Default YIN parameters
 */
export const DEFAULT_YIN_PARAMS: YinParams = {
  frameSize: 2048,
  hopSize: 256,
  threshold: 0.3,
  fallbackThreshold: 0.8,
  minFreq: 30,
  maxFreq: 400,
  interpolation: true,
  differenceMethod: "fftZeroPadding",
  thresholdMethod: "adaptive",
  powerConfidenceAdjust: true,
  minPowerThreshold: 0.02,
  octaveJumpCorrection: false,
  octaveRatioThreshold: 0.1,
  medianFilterWindowSize: 5,
};

/**
 * Create a new audio instance with default values
 */
export function createAudioInstance(options: CreateAudioInstanceOptions): AudioInstance {
  return {
    id: options.id,
    label: options.label,
    audioBuffer: null,
    spectrogramData: [],
    yinData: [],
    yinParams: {
      ...DEFAULT_YIN_PARAMS,
      ...options.yinParams,
    },
    isPlaying: false,
    progressPercentage: 0,
    showProgress: false,
    showYinControls: options.showYinControls ?? true,
    showRecordingControls: options.showRecordingControls ?? false,
  };
}

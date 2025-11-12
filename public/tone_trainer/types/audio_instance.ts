import type { PitchFrame, YinParams } from "../utils/pitchProcessing";

/**
 * Represents a single audio instance with all its visualization data and state
 */
export interface AudioInstance {
  id: string;
  label?: string; // Display name like "Sample Audio" or "Recording"
  audioBuffer: AudioBuffer | null;
  spectrogramData: number[][];
  yinData: PitchFrame[];
  yinParams: YinParams;
  isPlaying: boolean;
  progressPercentage: number;
  showProgress: boolean;
  showYinControls: boolean; // Whether to show YIN parameter controls
  showRecordingControls: boolean; // Whether to show recording settings
}

/**
 * Type for creating a new audio instance
 */
export interface CreateAudioInstanceOptions {
  id: string;
  label?: string;
  showYinControls?: boolean;
  showRecordingControls?: boolean;
  yinParams?: Partial<YinParams>;
}

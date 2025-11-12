import React, { createContext, useContext, useState, useRef, useCallback, type ReactNode, type Dispatch, type SetStateAction, type MutableRefObject } from "react";
import { RECORDING_SAMPLE_RATE } from "../utils/constants";
import type { PitchFrame, YinParams } from "../utils/pitchProcessing";

export interface StatusMessageState {
  message: string;
  isLoading: boolean;
  spinnerColor?: string;
  backgroundColor?: string;
}

export interface VisualizationSettings {
  colorScheme: string;
  brightness: number;
  contrast: number;
}

export interface RecordingSettings {
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface ToneAnalyzerContextValue {
  // State
  audioContext: AudioContext | null;
  isRecording: boolean;
  setIsRecording: Dispatch<SetStateAction<boolean>>;
  isPlaying: boolean;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  spectrogramData: number[][];
  setSpectrogramData: Dispatch<SetStateAction<number[][]>>;
  yinData: PitchFrame[];
  setYinData: Dispatch<SetStateAction<PitchFrame[]>>;
  lastAudioBuffer: AudioBuffer | null;
  setLastAudioBuffer: Dispatch<SetStateAction<AudioBuffer | null>>;
  statusMessage: StatusMessageState | null;
  setStatusMessage: Dispatch<SetStateAction<StatusMessageState | null>>;
  progressPercentage: number;
  setProgressPercentage: Dispatch<SetStateAction<number>>;
  showProgress: boolean;
  setShowProgress: Dispatch<SetStateAction<boolean>>;

  // Settings
  settings: VisualizationSettings;
  setSettings: Dispatch<SetStateAction<VisualizationSettings>>;
  recordingSettings: RecordingSettings;
  setRecordingSettings: Dispatch<SetStateAction<RecordingSettings>>;
  yinParams: YinParams;
  setYinParams: Dispatch<SetStateAction<YinParams>>;

  // Refs
  mediaRecorderRef: MutableRefObject<MediaRecorder | null>;
  audioChunksRef: MutableRefObject<Blob[]>;
  currentAudioSourceRef: MutableRefObject<AudioBufferSourceNode | null>;
  progressAnimationFrameRef: MutableRefObject<number | null>;
  audioDurationRef: MutableRefObject<number | null>;

  // Methods
  ensureAudioContext: () => AudioContext;
}

const ToneAnalyzerContext = createContext<ToneAnalyzerContextValue | null>(null);

export function useToneAnalyzer(): ToneAnalyzerContextValue {
  const context = useContext(ToneAnalyzerContext);
  if (!context) {
    throw new Error(
      "useToneAnalyzer must be used within ToneAnalyzerProvider"
    );
  }
  return context;
}

interface ToneAnalyzerProviderProps {
  children: ReactNode;
}

export function ToneAnalyzerProvider({ children }: ToneAnalyzerProviderProps) {
  // Audio & State
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [spectrogramData, setSpectrogramData] = useState<number[][]>([]);
  const [yinData, setYinData] = useState<PitchFrame[]>([]);
  const [lastAudioBuffer, setLastAudioBuffer] = useState<AudioBuffer | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessageState | null>(null);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  // Refs for non-reactive values
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const progressAnimationFrameRef = useRef<number | null>(null);
  const audioDurationRef = useRef<number | null>(null);

  // Visualization Settings
  const [settings, setSettings] = useState<VisualizationSettings>({
    colorScheme: "viridis",
    brightness: -75,
    contrast: 1.5,
  });

  // Recording Settings
  const [recordingSettings, setRecordingSettings] = useState<RecordingSettings>({
    sampleRate: 48000,
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  });

  // YIN Algorithm Parameters
  const [yinParams, setYinParams] = useState<YinParams>({
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
  });

  // Ensure audio context is initialized
  const ensureAudioContext = useCallback((): AudioContext => {
    if (!audioContext) {
      const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextConstructor({
        sampleRate: RECORDING_SAMPLE_RATE,
      });
      setAudioContext(ctx);
      return ctx;
    }
    return audioContext;
  }, [audioContext]);

  const value: ToneAnalyzerContextValue = {
    // State
    audioContext,
    isRecording,
    setIsRecording,
    isPlaying,
    setIsPlaying,
    spectrogramData,
    setSpectrogramData,
    yinData,
    setYinData,
    lastAudioBuffer,
    setLastAudioBuffer,
    statusMessage,
    setStatusMessage,
    progressPercentage,
    setProgressPercentage,
    showProgress,
    setShowProgress,

    // Settings
    settings,
    setSettings,
    recordingSettings,
    setRecordingSettings,
    yinParams,
    setYinParams,

    // Refs
    mediaRecorderRef,
    audioChunksRef,
    currentAudioSourceRef,
    progressAnimationFrameRef,
    audioDurationRef,

    // Methods
    ensureAudioContext,
  };

  return (
    <ToneAnalyzerContext.Provider value={value}>
      {children}
    </ToneAnalyzerContext.Provider>
  );
}

import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { RECORDING_SAMPLE_RATE } from "../utils/constants.js";

const ToneAnalyzerContext = createContext(null);

export function useToneAnalyzer() {
  const context = useContext(ToneAnalyzerContext);
  if (!context) {
    throw new Error(
      "useToneAnalyzer must be used within ToneAnalyzerProvider"
    );
  }
  return context;
}

export function ToneAnalyzerProvider({ children }) {
  // Audio & State
  const [audioContext, setAudioContext] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [spectrogramData, setSpectrogramData] = useState([]);
  const [yinData, setYinData] = useState([]);
  const [lastAudioBuffer, setLastAudioBuffer] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  // Refs for non-reactive values
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentAudioSourceRef = useRef(null);
  const progressAnimationFrameRef = useRef(null);
  const audioDurationRef = useRef(null);

  // Visualization Settings
  const [settings, setSettings] = useState({
    colorScheme: "viridis",
    brightness: -75,
    contrast: 1.5,
  });

  // Recording Settings
  const [recordingSettings, setRecordingSettings] = useState({
    sampleRate: 48000,
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  });

  // YIN Algorithm Parameters
  const [yinParams, setYinParams] = useState({
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
  const ensureAudioContext = useCallback(() => {
    if (!audioContext) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: RECORDING_SAMPLE_RATE,
      });
      setAudioContext(ctx);
      return ctx;
    }
    return audioContext;
  }, [audioContext]);

  const value = {
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

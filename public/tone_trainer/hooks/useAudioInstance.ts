import { useState, useRef, useCallback } from "react";
import { performYinAnalysis } from "../utils/yinAlgorithm";
import { processAudioBuffer as processAudio } from "../utils/audioProcessing";
import { createAudioInstance } from "../utils/instanceUtils";
import type { AudioInstance, CreateAudioInstanceOptions } from "../types/audio_instance";

export interface UseAudioInstanceReturn {
  instance: AudioInstance;
  setInstance: React.Dispatch<React.SetStateAction<AudioInstance>>;
  yinLoading: boolean;
  playAudio: (buffer?: AudioBuffer) => Promise<void>;
  stopPlayback: () => void;
  togglePlayStop: () => void;
  recomputeYin: () => void;
  processAudioBuffer: (audioBuffer: AudioBuffer) => Promise<AudioBuffer>;
  updateYinParams: (yinParams: AudioInstance["yinParams"]) => void;
}

/**
 * Custom hook to manage a single audio instance
 * Handles playback, YIN processing, and state management
 */
export function useAudioInstance(
  options: CreateAudioInstanceOptions,
  audioContext: AudioContext | null,
  onStatusChange?: (message: string, isLoading: boolean, backgroundColor?: string, spinnerColor?: string) => void
): UseAudioInstanceReturn {
  const [instance, setInstance] = useState<AudioInstance>(() => createAudioInstance(options));
  const [yinLoading, setYinLoading] = useState(false);

  // Refs for playback control
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const progressFrameRef = useRef<number | null>(null);
  const durationRef = useRef<number | null>(null);

  // Process audio buffer
  const processAudioBuffer = useCallback(
    async (audioBuffer: AudioBuffer) => {
      try {
        onStatusChange?.("Computing YIN pitch analysis...", true, undefined, "border-purple-300");

        const result = await processAudio(audioBuffer, instance.yinParams);

        setInstance((prev) => ({
          ...prev,
          audioBuffer,
          spectrogramData: result.spectrogramData,
          yinData: result.yinData,
        }));

        onStatusChange?.("", false);
        return audioBuffer;
      } catch (err) {
        throw err;
      }
    },
    [instance.yinParams, onStatusChange]
  );

  // Play audio
  const playAudio = useCallback(async (buffer?: AudioBuffer) => {
    const bufferToPlay = buffer ?? instance.audioBuffer;
    if (!bufferToPlay || !audioContext) return;

    // Stop any currently playing audio
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch {
        // Ignore
      }
    }
    if (progressFrameRef.current) {
      cancelAnimationFrame(progressFrameRef.current);
    }

    // Resume AudioContext if suspended
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = bufferToPlay;
    source.connect(audioContext.destination);

    setInstance((prev) => ({
      ...prev,
      showProgress: true,
      progressPercentage: 0,
      isPlaying: true,
    }));

    durationRef.current = bufferToPlay.duration;
    audioSourceRef.current = source;

    let playbackStartTime: number | null = null;

    function updateProgress(): void {
      if (playbackStartTime === null) {
        playbackStartTime = performance.now();
      }

      const elapsed = (performance.now() - playbackStartTime) / 1000;
      const duration = durationRef.current;
      if (!duration) return;

      const progress = Math.min((elapsed / duration) * 100, 100);

      setInstance((prev) => ({ ...prev, progressPercentage: progress }));

      if (progress >= 100 || elapsed >= duration) {
        setInstance((prev) => ({
          ...prev,
          isPlaying: false,
          progressPercentage: 100,
        }));
        audioSourceRef.current = null;
        progressFrameRef.current = null;
        setTimeout(() => {
          setInstance((prev) => ({ ...prev, showProgress: false }));
        }, 1000);
      } else {
        progressFrameRef.current = requestAnimationFrame(updateProgress);
      }
    }

    source.onended = () => {
      if (progressFrameRef.current) {
        cancelAnimationFrame(progressFrameRef.current);
        progressFrameRef.current = null;
      }
      setInstance((prev) => ({
        ...prev,
        isPlaying: false,
        showProgress: false,
      }));
      audioSourceRef.current = null;
    };

    source.start(0);
    progressFrameRef.current = requestAnimationFrame(updateProgress);
  }, [instance.audioBuffer, audioContext]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch {
        // Ignore
      }
      audioSourceRef.current = null;
    }

    if (progressFrameRef.current) {
      cancelAnimationFrame(progressFrameRef.current);
      progressFrameRef.current = null;
    }

    setInstance((prev) => ({
      ...prev,
      isPlaying: false,
      showProgress: false,
      progressPercentage: 0,
    }));
  }, []);

  // Toggle play/stop
  const togglePlayStop = useCallback(() => {
    if (instance.isPlaying) {
      stopPlayback();
    } else if (instance.audioBuffer) {
      playAudio();
    }
  }, [instance.isPlaying, instance.audioBuffer, stopPlayback, playAudio]);

  // Recompute YIN
  const recomputeYin = useCallback(() => {
    if (!instance.audioBuffer) return;

    setYinLoading(true);
    setTimeout(() => {
      const newYinData = performYinAnalysis(instance.audioBuffer!, instance.yinParams);
      setInstance((prev) => ({ ...prev, yinData: newYinData }));
      setYinLoading(false);
    }, 10);
  }, [instance.audioBuffer, instance.yinParams]);

  // Update YIN params
  const updateYinParams = useCallback((yinParams: AudioInstance["yinParams"]) => {
    setInstance((prev) => ({ ...prev, yinParams }));
  }, []);

  return {
    instance,
    setInstance,
    yinLoading,
    playAudio,
    stopPlayback,
    togglePlayStop,
    recomputeYin,
    processAudioBuffer,
    updateYinParams,
  };
}

import { useCallback, useRef, useState } from "react";
import { useToneAnalyzer } from "../context/ToneAnalyzerContext.jsx";

export function useAudioPlayback() {
  const {
    audioContext,
    isPlaying,
    setIsPlaying,
    lastAudioBuffer,
    currentAudioSourceRef,
    progressAnimationFrameRef,
    audioDurationRef,
  } = useToneAnalyzer();

  const [progressPercentage, setProgressPercentage] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  const playAudio = useCallback(
    async (audioBuffer) => {
      if (!audioContext) return;

      // Stop any currently playing audio
      if (currentAudioSourceRef.current) {
        try {
          currentAudioSourceRef.current.stop();
        } catch (e) {
          // Ignore errors if source already stopped
        }
      }
      if (progressAnimationFrameRef.current) {
        cancelAnimationFrame(progressAnimationFrameRef.current);
        progressAnimationFrameRef.current = null;
      }

      // Resume AudioContext if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      setShowProgress(true);
      setProgressPercentage(0);

      audioDurationRef.current = audioBuffer.duration;
      currentAudioSourceRef.current = source;
      setIsPlaying(true);

      let playbackStartTime = null;

      function updateProgress() {
        if (!isPlaying) {
          progressAnimationFrameRef.current = null;
          return;
        }

        if (playbackStartTime === null) {
          playbackStartTime = performance.now();
        }

        const elapsed = (performance.now() - playbackStartTime) / 1000;
        const progress = Math.min(
          (elapsed / audioDurationRef.current) * 100,
          100
        );

        setProgressPercentage(progress);

        if (progress >= 100 || elapsed >= audioDurationRef.current) {
          setIsPlaying(false);
          currentAudioSourceRef.current = null;
          setProgressPercentage(100);
          progressAnimationFrameRef.current = null;
          setTimeout(() => {
            setShowProgress(false);
          }, 1000);
        } else {
          progressAnimationFrameRef.current =
            requestAnimationFrame(updateProgress);
        }
      }

      source.onended = () => {
        if (progressAnimationFrameRef.current) {
          cancelAnimationFrame(progressAnimationFrameRef.current);
          progressAnimationFrameRef.current = null;
        }
        setIsPlaying(false);
        currentAudioSourceRef.current = null;
        setShowProgress(false);
      };

      source.start(0);
      progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);
    },
    [
      audioContext,
      isPlaying,
      setIsPlaying,
      currentAudioSourceRef,
      progressAnimationFrameRef,
      audioDurationRef,
    ]
  );

  const stopPlayback = useCallback(() => {
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
      } catch (e) {
        // Ignore errors if source already stopped
      }
      currentAudioSourceRef.current = null;
    }
    if (progressAnimationFrameRef.current) {
      cancelAnimationFrame(progressAnimationFrameRef.current);
      progressAnimationFrameRef.current = null;
    }
    setIsPlaying(false);
    setShowProgress(false);
    setProgressPercentage(0);
  }, [
    setIsPlaying,
    currentAudioSourceRef,
    progressAnimationFrameRef,
  ]);

  const togglePlayStop = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else if (lastAudioBuffer) {
      playAudio(lastAudioBuffer);
    }
  }, [isPlaying, lastAudioBuffer, stopPlayback, playAudio]);

  return {
    playAudio,
    stopPlayback,
    togglePlayStop,
    progressPercentage,
    showProgress,
  };
}

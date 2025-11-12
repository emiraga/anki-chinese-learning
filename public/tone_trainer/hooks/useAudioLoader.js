import { useCallback } from "react";
import { useToneAnalyzer } from "../context/ToneAnalyzerContext";
import { useAudioProcessing } from "./useAudioProcessing";
import { useAudioPlayback } from "./useAudioPlayback";

export function useAudioLoader() {
  const {
    audioContext,
    setStatusMessage,
    yinParams,
    setYinParams,
    ensureAudioContext,
  } = useToneAnalyzer();

  const { processAudioBuffer } = useAudioProcessing();
  const { playAudio, stopPlayback } = useAudioPlayback();

  const loadAudioFile = useCallback(
    async (filePath, needMaxFreq = null) => {
      try {
        // Stop any currently playing audio
        stopPlayback();

        // Scroll to top of page
        window.scrollTo({ top: 0, behavior: "smooth" });

        // Adjust Max Freq if specified
        if (needMaxFreq !== null && yinParams.maxFreq !== needMaxFreq) {
          setYinParams((prev) => ({ ...prev, maxFreq: needMaxFreq }));
        }

        // Show loading indicator
        setStatusMessage({
          text: "Loading audio file...",
          isLoading: true,
          spinnerColor: "border-blue-300",
          backgroundColor: "#3b82f6",
        });

        // Initialize audio context
        const ctx = ensureAudioContext();

        // Fetch the audio file
        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`Failed to load audio file: ${response.statusText}`);
        }

        // Read as array buffer
        const arrayBuffer = await response.arrayBuffer();

        // Decode audio data
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        // Process the audio buffer
        const success = await processAudioBuffer(audioBuffer);

        if (success) {
          // Auto-play the audio
          playAudio(audioBuffer);
        }
      } catch (err) {
        console.error("Error loading audio file:", err);
        setStatusMessage({
          text: "Could not load audio file. Please try again.",
          isLoading: false,
          backgroundColor: "#d97706",
        });
      }
    },
    [
      stopPlayback,
      yinParams.maxFreq,
      setYinParams,
      setStatusMessage,
      ensureAudioContext,
      processAudioBuffer,
      playAudio,
    ]
  );

  const loadDroppedAudio = useCallback(
    async (file) => {
      try {
        // Stop any currently playing audio
        stopPlayback();

        // Show loading indicator
        setStatusMessage({
          text: "Processing audio file...",
          isLoading: true,
          spinnerColor: "border-blue-300",
          backgroundColor: "#3b82f6",
        });

        // Initialize audio context
        const ctx = ensureAudioContext();

        // Read file as array buffer
        const arrayBuffer = await file.arrayBuffer();

        // Decode audio data
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        // Process the audio buffer
        const success = await processAudioBuffer(audioBuffer);

        if (success) {
          // Auto-play the audio
          playAudio(audioBuffer);
        }
      } catch (err) {
        console.error("Error loading dropped audio:", err);
        setStatusMessage({
          text: "Could not process audio file. Make sure it's a valid audio format.",
          isLoading: false,
          backgroundColor: "#d97706",
        });
      }
    },
    [
      stopPlayback,
      setStatusMessage,
      ensureAudioContext,
      processAudioBuffer,
      playAudio,
    ]
  );

  return {
    loadAudioFile,
    loadDroppedAudio,
  };
}

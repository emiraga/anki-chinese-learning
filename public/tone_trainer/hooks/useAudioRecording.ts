import { useCallback } from "react";
import { useToneAnalyzer } from "../context/ToneAnalyzerContext";
import { useAudioProcessing } from "./useAudioProcessing";

export interface UseAudioRecordingReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const {
    isRecording,
    setIsRecording,
    recordingSettings,
    mediaRecorderRef,
    audioChunksRef,
    setStatusMessage,
    ensureAudioContext,
  } = useToneAnalyzer();

  const { processAudioBuffer } = useAudioProcessing();

  const startRecording = useCallback(async (): Promise<void> => {
    if (isRecording) {
      return;
    }
    setIsRecording(true);
    audioChunksRef.current = [];

    try {
      // Ensure AudioContext is created
      const ctx = ensureAudioContext();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: recordingSettings.channelCount },
          sampleRate: { ideal: recordingSettings.sampleRate },
          echoCancellation: recordingSettings.echoCancellation,
          noiseSuppression: recordingSettings.noiseSuppression,
          autoGainControl: recordingSettings.autoGainControl,
        },
      });

      if (!stream) {
        return;
      }

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.onstart = () => {
        setStatusMessage({
          message: "Recording...",
          isLoading: false,
          backgroundColor: "#ef4444",
        });
      };

      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        setStatusMessage({
          message: "Analyzing...",
          isLoading: true,
          backgroundColor: "#3b82f6",
        });

        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          await processAudioBuffer(audioBuffer);
        } catch (err) {
          console.error("Error decoding audio data:", err);
          setStatusMessage({
            message: "Could not process audio. Please try again.",
            isLoading: false,
            backgroundColor: "#d97706",
          });
        }

        // Clean up media stream
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setStatusMessage({
        message: "Microphone access denied. Please allow access and try again.",
        isLoading: false,
        backgroundColor: "#d97706",
      });
      setIsRecording(false);
    }
  }, [
    isRecording,
    setIsRecording,
    recordingSettings,
    mediaRecorderRef,
    audioChunksRef,
    setStatusMessage,
    ensureAudioContext,
    processAudioBuffer,
  ]);

  const stopRecording = useCallback((): void => {
    if (!isRecording || !mediaRecorderRef.current) {
      return;
    }
    setIsRecording(false);
    mediaRecorderRef.current.stop();
  }, [isRecording, setIsRecording, mediaRecorderRef]);

  return {
    startRecording,
    stopRecording,
  };
}

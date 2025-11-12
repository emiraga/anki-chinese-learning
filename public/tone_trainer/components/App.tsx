import React, { useEffect, useState, useCallback } from "react";
import { ToneAnalyzerProvider, useToneAnalyzer } from "../context/ToneAnalyzerContext";
import { useAudioInstance } from "../hooks/useAudioInstance";
import { AudioVisualizerPanel } from "./AudioVisualizerPanel";
import { DropOverlay } from "./DropOverlay";
import { StatusMessage } from "./StatusMessage";
import { DisplayControls } from "./DisplayControls";
import { AudioFilesList } from "./AudioFilesList";
import { DebugTools } from "./DebugTools";

function AppContent() {
  const {
    statusMessage,
    setStatusMessage,
    audioContext,
    ensureAudioContext,
    settings,
    recordingSettings,
    mediaRecorderRef,
    audioChunksRef,
  } = useToneAnalyzer();

  const [showDropOverlay, setShowDropOverlay] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Helper to set status message
  const handleStatusChange = useCallback(
    (message: string, isLoading: boolean, backgroundColor?: string, spinnerColor?: string) => {
      if (message) {
        setStatusMessage({ message, isLoading, backgroundColor, spinnerColor });
      } else {
        setStatusMessage(null);
      }
    },
    [setStatusMessage]
  );

  // Two audio instances using the custom hook
  const sampleAudio = useAudioInstance(
    {
      id: "sample",
      label: "Sample Audio",
      showYinControls: true,
      showRecordingControls: false,
    },
    audioContext,
    handleStatusChange
  );

  const recordingAudio = useAudioInstance(
    {
      id: "recording",
      label: "Recording",
      showYinControls: true,
      showRecordingControls: true,
    },
    audioContext,
    handleStatusChange
  );

  // Load audio file for sample instance
  const loadAudioFile = useCallback(
    async (filePath: string, needMaxFreq: number | null = null) => {
      try {
        sampleAudio.stopPlayback();
        window.scrollTo({ top: 0, behavior: "smooth" });

        // Adjust Max Freq if specified
        if (needMaxFreq !== null && sampleAudio.instance.yinParams.maxFreq !== needMaxFreq) {
          sampleAudio.updateYinParams({
            ...sampleAudio.instance.yinParams,
            maxFreq: needMaxFreq,
          });
        }

        setStatusMessage({
          message: "Loading audio file...",
          isLoading: true,
          spinnerColor: "border-blue-300",
          backgroundColor: "#3b82f6",
        });

        const ctx = ensureAudioContext();
        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`Failed to load audio file: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        await sampleAudio.processAudioBuffer(audioBuffer);
        sampleAudio.playAudio();
      } catch (err) {
        console.error("Error loading audio file:", err);
        setStatusMessage({
          message: "Could not load audio file. Please try again.",
          isLoading: false,
          backgroundColor: "#d97706",
        });
      }
    },
    [sampleAudio, ensureAudioContext, setStatusMessage]
  );

  // Load dropped audio for sample instance
  const loadDroppedAudio = useCallback(
    async (file: File) => {
      try {
        sampleAudio.stopPlayback();

        setStatusMessage({
          message: "Processing audio file...",
          isLoading: true,
          spinnerColor: "border-blue-300",
          backgroundColor: "#3b82f6",
        });

        const ctx = ensureAudioContext();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        await sampleAudio.processAudioBuffer(audioBuffer);
        sampleAudio.playAudio();
      } catch (err) {
        console.error("Error loading dropped audio:", err);
        setStatusMessage({
          message: "Could not process audio file. Make sure it's a valid audio format.",
          isLoading: false,
          backgroundColor: "#d97706",
        });
      }
    },
    [sampleAudio, ensureAudioContext, setStatusMessage]
  );

  // Recording functions
  const startRecording = useCallback(async () => {
    if (isRecording) return;
    setIsRecording(true);
    audioChunksRef.current = [];

    try {
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
          await recordingAudio.processAudioBuffer(audioBuffer);
        } catch (err) {
          console.error("Error decoding audio data:", err);
          setStatusMessage({
            message: "Could not process audio. Please try again.",
            isLoading: false,
            backgroundColor: "#d97706",
          });
        }

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
  }, [isRecording, recordingSettings, ensureAudioContext, setStatusMessage, audioChunksRef, mediaRecorderRef, recordingAudio]);

  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;
    setIsRecording(false);
    mediaRecorderRef.current.stop();
  }, [isRecording, mediaRecorderRef]);

  // Load default audio on mount
  useEffect(() => {
    loadAudioFile("audio/ai_讀書寫字.mp3");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        startRecording();
      } else if (e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        if (sampleAudio.instance.audioBuffer) {
          sampleAudio.togglePlayStop();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        stopRecording();
      }
    };

    const handleBlur = () => {
      stopRecording();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [sampleAudio, startRecording, stopRecording]);

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setShowDropOverlay(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDropOverlay(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("audio/")) {
        loadDroppedAudio(file);
      } else {
        alert("Please drop an audio file (MP3, WAV, OGG, M4A)");
      }
    }
  };

  return (
    <div
      className="flex-col items-center justify-center min-h-screen p-4"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <DropOverlay show={showDropOverlay} />

      {/* Status Message */}
      {statusMessage && (
        <div className="w-full max-w-4xl mx-auto mb-4">
          <StatusMessage
            message={statusMessage.message}
            isLoading={statusMessage.isLoading}
            spinnerColor={statusMessage.spinnerColor}
            backgroundColor={statusMessage.backgroundColor}
          />
        </div>
      )}

      {/* Sample Audio Instance */}
      <AudioVisualizerPanel
        instance={sampleAudio.instance}
        audioContext={audioContext}
        visualizationSettings={settings}
        onPlayStop={sampleAudio.togglePlayStop}
        onYinParamsChange={sampleAudio.updateYinParams}
        onRecomputeYin={sampleAudio.recomputeYin}
        showYinLoadingOverlay={sampleAudio.yinLoading}
      />

      {/* Recording Instance */}
      <AudioVisualizerPanel
        instance={recordingAudio.instance}
        audioContext={audioContext}
        visualizationSettings={settings}
        onPlayStop={recordingAudio.togglePlayStop}
        onYinParamsChange={recordingAudio.updateYinParams}
        onRecomputeYin={recordingAudio.recomputeYin}
        showYinLoadingOverlay={recordingAudio.yinLoading}
      />

      {/* Display Controls (shared) */}
      <div className="w-full max-w-4xl mx-auto">
        <DisplayControls onRedraw={() => {}} />
      </div>

      {/* Instructions */}
      <div className="w-full max-w-4xl mx-auto mt-4 p-3.5 text-center text-gray-300">
        Press{" "}
        <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">
          Enter
        </kbd>{" "}
        to play sample audio, hold{" "}
        <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">
          Space
        </kbd>{" "}
        to record, or drag & drop an audio file.
      </div>

      {/* Audio File Links */}
      <AudioFilesList onLoadAudio={loadAudioFile} />

      {/* Debug Section */}
      <DebugTools />
    </div>
  );
}

export function App() {
  return (
    <ToneAnalyzerProvider>
      <AppContent />
    </ToneAnalyzerProvider>
  );
}

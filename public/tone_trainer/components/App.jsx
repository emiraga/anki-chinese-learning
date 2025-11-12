import React, { useEffect, useState, useCallback } from "react";
import { ToneAnalyzerProvider, useToneAnalyzer } from "../context/ToneAnalyzerContext";
import { useAudioRecording } from "../hooks/useAudioRecording";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { useAudioLoader } from "../hooks/useAudioLoader";
import { useAudioProcessing } from "../hooks/useAudioProcessing";
import { performYinAnalysis } from "../utils/yinAlgorithm";
import { SpectrogramCanvas } from "./SpectrogramCanvas.jsx";
import { YinPitchCanvas } from "./YinPitchCanvas.jsx";
import { DropOverlay } from "./DropOverlay.tsx";
import { StatusMessage } from "./StatusMessage";
import { ProgressLine } from "./ProgressLine.tsx";
import { PlaybackControls } from "./PlaybackControls.tsx";
import { AudioFilesList } from "./AudioFilesList.tsx";
import { DebugTools } from "./DebugTools.tsx";
import { DisplayControls } from "./DisplayControls.jsx";
import { RecordingControls } from "./RecordingControls.jsx";
import { YinControls } from "./YinControls.jsx";

function AppContent() {
  const {
    statusMessage,
    lastAudioBuffer,
    yinParams,
    setYinData,
    spectrogramData,
    progressPercentage,
    showProgress,
  } = useToneAnalyzer();

  const { startRecording, stopRecording } = useAudioRecording();
  const { togglePlayStop } = useAudioPlayback();
  const { loadAudioFile, loadDroppedAudio } = useAudioLoader();

  const [showDropOverlay, setShowDropOverlay] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [showYinLoadingOverlay, setShowYinLoadingOverlay] = useState(false);

  // Load default audio on mount
  useEffect(() => {
    loadAudioFile("audio/ai_讀書寫字.mp3");
  }, []);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        startRecording();
      } else if (e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        if (lastAudioBuffer) {
          togglePlayStop();
        }
      }
    };

    const handleKeyUp = (e) => {
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
  }, [lastAudioBuffer, startRecording, stopRecording, togglePlayStop]);

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    setDragCounter((prev) => prev + 1);
    setShowDropOverlay(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setShowDropOverlay(false);
      }
      return newCount;
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(0);
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

  // Recompute YIN analysis
  const handleRecomputeYin = useCallback(() => {
    if (lastAudioBuffer) {
      setShowYinLoadingOverlay(true);
      setTimeout(() => {
        const newYinData = performYinAnalysis(lastAudioBuffer, yinParams);
        setYinData(newYinData);
        setShowYinLoadingOverlay(false);
      }, 10);
    }
  }, [lastAudioBuffer, yinParams, setYinData]);

  // Redraw visualization (for display settings changes)
  const handleRedraw = useCallback(() => {
    // The canvases will redraw automatically when their dependencies change
    // This is just a placeholder for any additional redraw logic
  }, []);

  return (
    <div
      className="flex-col items-center justify-center min-h-screen p-4"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <DropOverlay show={showDropOverlay} />

      <div className="w-full max-w-4xl mx-auto">
        {/* Spectrogram Canvas with YIN Pitch Overlay */}
        <div className="w-full bg-gray-900 rounded-lg shadow-lg p-2 relative transition-all duration-200">
          <div className="relative">
            <SpectrogramCanvas />
            <YinPitchCanvas />
            <ProgressLine show={showProgress} percentage={progressPercentage} />
          </div>

          {/* YIN Loading Overlay */}
          {showYinLoadingOverlay && (
            <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2" />
                <p className="text-gray-300 text-sm">Computing YIN pitch...</p>
              </div>
            </div>
          )}

          {/* Play Button */}
          <PlaybackControls onPlayStop={togglePlayStop} />
        </div>

        {/* Status Message */}
        {statusMessage && (
          <StatusMessage
            message={statusMessage.message}
            isLoading={statusMessage.isLoading}
            spinnerColor={statusMessage.spinnerColor}
            backgroundColor={statusMessage.backgroundColor}
          />
        )}

        {/* YIN Controls */}
        {spectrogramData.length > 0 && (
          <div className="mt-3">
            <YinControls
              onRecompute={handleRecomputeYin}
              onRedraw={handleRedraw}
            />
          </div>
        )}

        {/* Display Controls */}
        <DisplayControls onRedraw={handleRedraw} />

        {/* Recording Controls */}
        <RecordingControls />
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

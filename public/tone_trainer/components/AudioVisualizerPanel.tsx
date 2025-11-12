import React from "react";
import { SpectrogramCanvas } from "./SpectrogramCanvas";
import { YinPitchCanvas } from "./YinPitchCanvas";
import { ProgressLine } from "./ProgressLine";
import { YinControls } from "./YinControls";
import { RecordingControls } from "./RecordingControls";
import type { AudioInstance } from "../types/audio_instance";
import type { VisualizationSettings } from "../context/ToneAnalyzerContext";

interface AudioVisualizerPanelProps {
  instance: AudioInstance;
  audioContext: AudioContext | null;
  visualizationSettings: VisualizationSettings;
  onPlayStop: () => void;
  onYinParamsChange: (params: AudioInstance["yinParams"]) => void;
  onRecomputeYin: () => void;
  showYinLoadingOverlay?: boolean;
  instructions?: React.ReactNode;
}

/**
 * Reusable audio visualizer panel component (fully controlled)
 * Supports infinite instances by taking all state as props
 */
export function AudioVisualizerPanel({
  instance,
  audioContext,
  visualizationSettings,
  onPlayStop,
  onYinParamsChange,
  onRecomputeYin,
  showYinLoadingOverlay = false,
  instructions,
}: AudioVisualizerPanelProps) {
  const handleRedraw = () => {
    // The canvases will redraw automatically when their dependencies change
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-8">
      {/* Instance Label */}
      <h2 className="text-xl font-semibold text-gray-200 mb-3">
        {instance.label}
      </h2>

      {/* Visualization Container */}
      <div className="w-full bg-gray-900 rounded-lg shadow-lg p-2 relative transition-all duration-200">
        <div className="relative">
          <SpectrogramCanvas
            spectrogramData={instance.spectrogramData}
            settings={visualizationSettings}
            audioContext={audioContext}
          />
          <YinPitchCanvas
            yinData={instance.yinData}
            yinParams={instance.yinParams}
            audioBuffer={instance.audioBuffer}
          />
          <ProgressLine
            show={instance.showProgress}
            percentage={instance.progressPercentage}
          />
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

        {/* Play Button and Instructions */}
        <div className="flex items-center justify-center gap-4 mt-3">
          <button
            onClick={onPlayStop}
            className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors duration-200 shadow-lg ${
              instance.isPlaying
                ? "bg-red-600 hover:bg-red-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
            title={instance.isPlaying ? "Stop audio" : "Play audio"}
            disabled={!instance.audioBuffer}
          >
            {instance.isPlaying ? (
              <svg
                className="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-white ml-0.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          {instructions && (
            <div className="text-sm text-gray-300">{instructions}</div>
          )}
        </div>
      </div>

      {/* YIN Controls */}
      {instance.showYinControls && instance.spectrogramData.length > 0 && (
        <div className="mt-3">
          <YinControls
            yinParams={instance.yinParams}
            onYinParamsChange={onYinParamsChange}
            onRecompute={onRecomputeYin}
            onRedraw={handleRedraw}
          />
        </div>
      )}

      {/* Recording Controls */}
      {instance.showRecordingControls && (
        <div className="mt-3">
          <RecordingControls />
        </div>
      )}
    </div>
  );
}

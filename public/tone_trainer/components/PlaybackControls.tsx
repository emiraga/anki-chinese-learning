import React from "react";
import { useToneAnalyzer } from "../context/ToneAnalyzerContext";

interface PlaybackControlsProps {
  onPlayStop: () => void;
}

export function PlaybackControls({ onPlayStop }: PlaybackControlsProps) {
  const { isPlaying } = useToneAnalyzer();

  return (
    <div className="flex justify-center mt-3">
      <button
        onClick={onPlayStop}
        className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors duration-200 shadow-lg ${
          isPlaying
            ? "bg-red-600 hover:bg-red-500"
            : "bg-blue-600 hover:bg-blue-500"
        }`}
        title={isPlaying ? "Stop audio" : "Play audio"}
      >
        {isPlaying ? (
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
      <div className="p-3.5">
        or press{" "}
        <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">
          Enter
        </kbd>{" "}
        to play, hold{" "}
        <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">
          Space
        </kbd>{" "}
        to record, or drag & drop an audio file.
      </div>
    </div>
  );
}

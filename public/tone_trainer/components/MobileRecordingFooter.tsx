import React from "react";

interface MobileRecordingFooterProps {
  isRecording: boolean;
  hasRecording: boolean;
  onRecordStart: () => void;
  onRecordStop: () => void;
}

export function MobileRecordingFooter({
  isRecording,
  hasRecording,
  onRecordStart,
  onRecordStop,
}: MobileRecordingFooterProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-600 shadow-lg z-50">
      <div className="max-w-4xl mx-auto p-4">
        {!hasRecording ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-200 text-center">
              Record Your Audio
            </h3>
            <div className="space-y-2 text-xs text-gray-300">
              <p className="flex items-center gap-2 justify-center">
                <span className="text-lg">🎤</span>
                <span>Tap and hold the button below to record</span>
              </p>
              <p className="flex items-center gap-2 justify-center">
                <span className="text-lg">🔴</span>
                <span>Release to stop recording</span>
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex justify-center mt-3">
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              if (!isRecording) {
                onRecordStart();
              }
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              if (isRecording) {
                onRecordStop();
              }
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              if (!isRecording) {
                onRecordStart();
              }
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              if (isRecording) {
                onRecordStop();
              }
            }}
            className={`px-8 py-4 rounded-full font-semibold transition-all ${
              isRecording
                ? "bg-red-500 text-white scale-110"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            {isRecording ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                Recording...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-xl">🎤</span>
                Hold to Record
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

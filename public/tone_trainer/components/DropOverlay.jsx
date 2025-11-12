import React from "react";

export function DropOverlay({ show }) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-blue-800/80 border-4 border-dashed border-blue-400 flex items-center justify-center"
      style={{ zIndex: 9999 }}
    >
      <div className="text-center">
        <svg
          className="w-16 h-16 mx-auto mb-4 text-blue-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          ></path>
        </svg>
        <p className="text-blue-100 text-xl font-medium">Drop audio file here</p>
        <p className="text-blue-200 text-sm mt-2">
          Supported formats: MP3, WAV, OGG, M4A
        </p>
      </div>
    </div>
  );
}

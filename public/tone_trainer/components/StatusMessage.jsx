import React from "react";

export function StatusMessage({ message, isLoading, spinnerColor = "border-blue-300", backgroundColor }) {
  if (!message) return null;

  return (
    <div
      className="text-center mb-4 p-3 rounded-lg bg-gray-700 transition-all duration-300"
      style={backgroundColor ? { backgroundColor } : {}}
    >
      <div className="flex items-center justify-center">
        {isLoading && (
          <div
            className={`animate-spin rounded-full h-4 w-4 border-b-2 ${spinnerColor} mr-2`}
          />
        )}
        <p className="text-lg font-medium text-blue-300">{message}</p>
      </div>
    </div>
  );
}

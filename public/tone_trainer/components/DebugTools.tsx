import React from "react";
import { useToneAnalyzer } from "../context/ToneAnalyzerContext";
import { downloadAudioBuffer } from "../utils/audioUtils";

export function DebugTools() {
  const { lastAudioBuffer } = useToneAnalyzer();

  const handleSaveAudio = () => {
    if (!lastAudioBuffer) {
      alert("No audio loaded to save");
      return;
    }

    try {
      downloadAudioBuffer(lastAudioBuffer);
      console.log("Audio file saved successfully");
    } catch (err) {
      console.error("Error saving audio file:", err);
      const message = err instanceof Error ? err.message : String(err);
      alert("Error saving audio file: " + message);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
        <h4 className="text-gray-300 text-sm font-medium mb-3">Debug Tools</h4>
        <div className="flex gap-3">
          <button
            onClick={handleSaveAudio}
            disabled={!lastAudioBuffer}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Audio File
          </button>
        </div>
      </div>
    </div>
  );
}

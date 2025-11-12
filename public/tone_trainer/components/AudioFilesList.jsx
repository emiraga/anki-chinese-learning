import React from "react";
import { SAMPLE_AUDIO_FILES } from "../utils/constants.js";

export function AudioFilesList({ onLoadAudio }) {
  return (
    <div className="w-full max-w-4xl mx-auto mt-3">
      <div className="bg-gray-700/50 p-4 rounded-lg">
        <h4 className="text-gray-300 text-sm font-medium mb-3">
          Load Sample Audio Files: (you can also drag-and-drop your own audio
          files)
        </h4>
        <div className="flex flex-col gap-3">
          {SAMPLE_AUDIO_FILES.map((file, index) => {
            const fileName = file.path.split("/").pop();
            return (
              <div key={index} className="flex items-center gap-3">
                <button
                  onClick={() => onLoadAudio(file.path, file.maxFreq)}
                  className="cursor-pointer px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors duration-200 whitespace-nowrap"
                >
                  {fileName}
                </button>
                <span className="text-gray-400 text-sm">{file.description}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { SAMPLE_AUDIO_FILES, TONE_PRACTICE_MATRIX, TONE_LABELS } from "../utils/constants";

interface AudioFilesListProps {
  onLoadAudio: (path: string, maxFreq: number | null, description?: string) => void;
}

export function AudioFilesList({ onLoadAudio }: AudioFilesListProps) {
  return (
    <div className="w-full max-w-4xl mx-auto mt-3 space-y-6">
      {/* Tone Practice Matrix */}
      <div className="bg-gray-700/50 p-4 rounded-lg">
        <h4 className="text-gray-300 text-sm font-medium mb-3">
          Tone Combination Practice (4x4 Matrix)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-600 p-2 bg-gray-800 text-gray-300 text-xs font-medium">
                  From → To
                </th>
                {TONE_LABELS.map((label, index) => (
                  <th
                    key={index}
                    className="border border-gray-600 p-2 bg-gray-800 text-gray-300 text-xs font-medium"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TONE_PRACTICE_MATRIX.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="border border-gray-600 p-2 bg-gray-800 text-gray-300 text-xs font-medium">
                    {TONE_LABELS[rowIndex]}
                  </td>
                  {row.map((file, colIndex) => {
                    const fileName = file.path.split("/").pop();
                    const description = `Tone ${rowIndex + 1} → Tone ${colIndex + 1}`;
                    return (
                      <td key={colIndex} className="border border-gray-600 p-2">
                        <button
                          onClick={() => onLoadAudio(file.path, file.maxFreq, description)}
                          className="w-full cursor-pointer px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded transition-colors duration-200"
                          title={fileName}
                        >
                          {rowIndex + 1}→{colIndex + 1}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regular Sample Audio Files */}
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
                  onClick={() => onLoadAudio(file.path, file.maxFreq, file.description)}
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

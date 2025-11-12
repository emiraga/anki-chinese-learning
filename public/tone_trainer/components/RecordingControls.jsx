import React from "react";
import { useToneAnalyzer } from "../context/ToneAnalyzerContext";
import { CollapsibleSection } from "./CollapsibleSection.jsx";

export function RecordingControls() {
  const { recordingSettings, setRecordingSettings } = useToneAnalyzer();

  const handleChange = (field, parser = (v) => v) => (e) => {
    const value = parser(e.target);
    setRecordingSettings((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <CollapsibleSection title="Recording Settings:">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 bg-gray-700/50 p-6 rounded-lg">
        <div>
          <label
            htmlFor="recordingSampleRate"
            className="block mb-2 text-sm font-medium text-gray-300"
          >
            Sample Rate (Hz)
          </label>
          <select
            id="recordingSampleRate"
            value={recordingSettings.sampleRate}
            onChange={handleChange("sampleRate", (t) => parseInt(t.value, 10))}
            className="bg-gray-600 border border-gray-500 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1"
          >
            <option value="8000">8000</option>
            <option value="16000">16000</option>
            <option value="22050">22050</option>
            <option value="44100">44100</option>
            <option value="48000">48000</option>
            <option value="96000">96000</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="recordingChannelCount"
            className="block mb-2 text-sm font-medium text-gray-300"
          >
            Channel Count
          </label>
          <select
            id="recordingChannelCount"
            value={recordingSettings.channelCount}
            onChange={handleChange("channelCount", (t) => parseInt(t.value, 10))}
            className="bg-gray-600 border border-gray-500 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1"
          >
            <option value="1">Mono (1)</option>
            <option value="2">Stereo (2)</option>
          </select>
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="recordingEchoCancellation"
            checked={recordingSettings.echoCancellation}
            onChange={handleChange("echoCancellation", (t) => t.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
          />
          <label
            htmlFor="recordingEchoCancellation"
            className="ml-2 text-sm font-medium text-gray-300"
          >
            Echo Cancellation
          </label>
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="recordingNoiseSuppression"
            checked={recordingSettings.noiseSuppression}
            onChange={handleChange("noiseSuppression", (t) => t.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
          />
          <label
            htmlFor="recordingNoiseSuppression"
            className="ml-2 text-sm font-medium text-gray-300"
          >
            Noise Suppression
          </label>
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="recordingAutoGainControl"
            checked={recordingSettings.autoGainControl}
            onChange={handleChange("autoGainControl", (t) => t.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
          />
          <label
            htmlFor="recordingAutoGainControl"
            className="ml-2 text-sm font-medium text-gray-300"
          >
            Auto Gain Control
          </label>
        </div>
      </div>
    </CollapsibleSection>
  );
}

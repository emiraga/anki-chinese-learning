import React from "react";
import { useToneAnalyzer } from "../context/ToneAnalyzerContext";
import { CollapsibleSection } from "./CollapsibleSection.tsx";

export function DisplayControls({ onRedraw }) {
  const { settings, setSettings } = useToneAnalyzer();

  const handleBrightnessChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setSettings((prev) => ({ ...prev, brightness: value }));
    onRedraw?.();
  };

  const handleContrastChange = (e) => {
    const value = parseFloat(e.target.value);
    setSettings((prev) => ({ ...prev, contrast: value }));
    onRedraw?.();
  };

  const handleColorSchemeChange = (e) => {
    const value = e.target.value;
    setSettings((prev) => ({ ...prev, colorScheme: value }));
    onRedraw?.();
  };

  return (
    <CollapsibleSection title="Display Settings:">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 bg-gray-700/50 p-6 rounded-lg">
        <div>
          <label
            htmlFor="brightness"
            className="block mb-2 text-sm font-medium text-gray-300"
          >
            Brightness
          </label>
          <input
            type="range"
            id="brightness"
            min="-150"
            max="100"
            value={settings.brightness}
            onChange={handleBrightnessChange}
            className="w-full"
          />
          <div className="text-xs text-gray-400 text-center mt-1">
            {settings.brightness}
          </div>
        </div>
        <div>
          <label
            htmlFor="contrast"
            className="block mb-2 text-sm font-medium text-gray-300"
          >
            Contrast
          </label>
          <input
            type="range"
            id="contrast"
            min="0.0"
            max="5.0"
            step="0.1"
            value={settings.contrast}
            onChange={handleContrastChange}
            className="w-full"
          />
          <div className="text-xs text-gray-400 text-center mt-1">
            {settings.contrast.toFixed(1)}
          </div>
        </div>
        <div>
          <label
            htmlFor="colorScheme"
            className="block mb-2 text-sm font-medium text-gray-300"
          >
            Color Scheme
          </label>
          <select
            id="colorScheme"
            value={settings.colorScheme}
            onChange={handleColorSchemeChange}
            className="bg-gray-600 border border-gray-500 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1"
          >
            <option value="viridis">Viridis</option>
            <option value="plasma">Plasma</option>
            <option value="hot">Hot</option>
            <option value="grayscale">Grayscale</option>
          </select>
        </div>
      </div>
    </CollapsibleSection>
  );
}

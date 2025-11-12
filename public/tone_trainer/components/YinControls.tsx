import React from "react";
import { CollapsibleSection } from "./CollapsibleSection";
import type { YinParams } from "../utils/pitchProcessing";

interface YinControlsProps {
  yinParams: YinParams;
  onYinParamsChange: (params: YinParams) => void;
  onRecompute?: () => void;
  onRedraw?: () => void;
}

/**
 * Prop-based YIN controls that don't rely on context
 */
export function YinControls({
  yinParams,
  onYinParamsChange,
  onRecompute,
  onRedraw,
}: YinControlsProps) {
  const handleStringChange = (field: string, shouldRecompute = true) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onYinParamsChange({ ...yinParams, [field]: value });
    if (shouldRecompute) {
      onRecompute?.();
    } else {
      onRedraw?.();
    }
  };

  const handleIntChange = (field: string, shouldRecompute = true) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    onYinParamsChange({ ...yinParams, [field]: value });
    if (shouldRecompute) {
      onRecompute?.();
    } else {
      onRedraw?.();
    }
  };

  const handleFloatChange = (field: string, shouldRecompute = true) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    onYinParamsChange({ ...yinParams, [field]: value });
    if (shouldRecompute) {
      onRecompute?.();
    } else {
      onRedraw?.();
    }
  };

  const handleBooleanChange = (field: string, shouldRecompute = true) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    onYinParamsChange({ ...yinParams, [field]: value });
    if (shouldRecompute) {
      onRecompute?.();
    } else {
      onRedraw?.();
    }
  };

  return (
    <CollapsibleSection title="YIN Algorithm parameters:">
      <div className="flex flex-col gap-3 bg-gray-700/50 p-4 rounded-lg">
        {/* Frame Analysis */}
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2">
            Frame Analysis
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="yinDifferenceMethod"
                className="block mb-2 text-xs font-medium text-gray-300"
              >
                Difference Function
              </label>
              <select
                id="yinDifferenceMethod"
                value={yinParams.differenceMethod}
                onChange={handleStringChange("differenceMethod")}
                className="bg-gray-600 border border-gray-500 text-white text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1"
              >
                <option value="simple">Simple (Slow)</option>
                <option value="fftSimple">FFT Simple</option>
                <option value="fftZeroPadding">FFT Zero-Padding</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="yinFrameSize"
                className="block mb-2 text-xs font-medium text-gray-300"
              >
                Frame Size
              </label>
              <select
                id="yinFrameSize"
                value={yinParams.frameSize}
                onChange={handleIntChange("frameSize")}
                className="bg-gray-600 border border-gray-500 text-white text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1"
              >
                <option value="128">128</option>
                <option value="256">256</option>
                <option value="512">512</option>
                <option value="1024">1024</option>
                <option value="2048">2048</option>
                <option value="4096">4096</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="yinHopSize"
                className="block mb-2 text-xs font-medium text-gray-300"
              >
                Hop Size
              </label>
              <select
                id="yinHopSize"
                value={yinParams.hopSize}
                onChange={handleIntChange("hopSize")}
                className="bg-gray-600 border border-gray-500 text-white text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1"
              >
                <option value="16">16</option>
                <option value="32">32</option>
                <option value="64">64</option>
                <option value="128">128</option>
                <option value="256">256</option>
                <option value="512">512</option>
                <option value="1024">1024</option>
                <option value="2048">2048</option>
                <option value="4096">4096</option>
              </select>
            </div>
          </div>
        </div>

        {/* Period Detection */}
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2">
            Period detection (with Threshold)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="yinThresholdMethod"
                className="block mb-2 text-xs font-medium text-gray-300"
              >
                Method
              </label>
              <select
                id="yinThresholdMethod"
                value={yinParams.thresholdMethod}
                onChange={handleStringChange("thresholdMethod")}
                className="bg-gray-600 border border-gray-500 text-white text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1"
              >
                <option value="simple">Simple</option>
                <option value="adaptive">Adaptive (Deepest Dip)</option>
                <option value="firstDip">First Dip (Robust)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="yinThreshold"
                className="block mb-2 text-xs font-medium text-gray-300"
              >
                Threshold
              </label>
              <input
                type="range"
                id="yinThreshold"
                min="0.05"
                max="0.9"
                step="0.01"
                value={yinParams.threshold}
                onChange={handleFloatChange("threshold")}
                className="w-full"
              />
              <div className="text-xs text-gray-400 text-center mt-1">
                {yinParams.threshold.toFixed(2)}
              </div>
            </div>

            <div>
              <label
                htmlFor="yinFallbackThreshold"
                className="block mb-2 text-xs font-medium text-gray-300"
              >
                Fallback
              </label>
              <input
                type="range"
                id="yinFallbackThreshold"
                min="0.1"
                max="1.0"
                step="0.05"
                value={yinParams.fallbackThreshold}
                onChange={handleFloatChange("fallbackThreshold")}
                className="w-full"
              />
              <div className="text-xs text-gray-400 text-center mt-1">
                {yinParams.fallbackThreshold.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Interpolation & Frequency */}
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2">
            Interpolation & Freq Range
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="yinInterpolation"
                checked={yinParams.interpolation}
                onChange={handleBooleanChange("interpolation")}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="yinInterpolation"
                className="ml-2 text-xs font-medium text-gray-300"
              >
                Parabolic Interpolation
              </label>
            </div>

            <div>
              <label
                htmlFor="yinMinFreq"
                className="block mb-2 text-xs font-medium text-gray-300"
              >
                Min Freq (Hz)
              </label>
              <input
                type="range"
                id="yinMinFreq"
                min="10"
                max="200"
                step="5"
                value={yinParams.minFreq}
                onChange={handleIntChange("minFreq")}
                className="w-full"
              />
              <div className="text-xs text-gray-400 text-center mt-1">
                {yinParams.minFreq}
              </div>
            </div>

            <div>
              <label
                htmlFor="yinMaxFreq"
                className="block mb-2 text-xs font-medium text-gray-300"
              >
                Max Freq (Hz)
              </label>
              <input
                type="range"
                id="yinMaxFreq"
                min="100"
                max="1000"
                step="10"
                value={yinParams.maxFreq}
                onChange={handleIntChange("maxFreq")}
                className="w-full"
              />
              <div className="text-xs text-gray-400 text-center mt-1">
                {yinParams.maxFreq}
              </div>
            </div>
          </div>
        </div>

        {/* Power Adjustment */}
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2">
            Audio Power based adjustment
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="yinPowerConfidenceAdjust"
                checked={yinParams.powerConfidenceAdjust}
                onChange={handleBooleanChange("powerConfidenceAdjust")}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="yinPowerConfidenceAdjust"
                className="ml-2 text-xs font-medium text-gray-300"
              >
                Power Confidence Adjust
              </label>
            </div>

            <div>
              <label
                htmlFor="yinMinPowerThreshold"
                className="block mb-2 text-xs font-medium text-gray-300"
              >
                Min Power Threshold
              </label>
              <input
                type="range"
                id="yinMinPowerThreshold"
                min="0.001"
                max="0.1"
                step="0.001"
                value={yinParams.minPowerThreshold}
                onChange={handleFloatChange("minPowerThreshold")}
                className="w-full"
              />
              <div className="text-xs text-gray-400 text-center mt-1">
                {yinParams.minPowerThreshold.toFixed(3)}
              </div>
            </div>
          </div>
        </div>

        {/* Pitch Smoothing */}
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2">
            Pitch smoothing and octave jump correction
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="yinMedianFilterWindowSize"
                className="block mb-2 text-xs font-medium text-gray-300"
              >
                Median Filter Window
              </label>
              <input
                type="range"
                id="yinMedianFilterWindowSize"
                min="1"
                max="11"
                step="2"
                value={yinParams.medianFilterWindowSize}
                onChange={handleIntChange("medianFilterWindowSize", false)}
                className="w-full"
              />
              <div className="text-xs text-gray-400 text-center mt-1">
                {yinParams.medianFilterWindowSize}
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="yinOctaveJumpCorrection"
                checked={yinParams.octaveJumpCorrection}
                onChange={handleBooleanChange("octaveJumpCorrection", false)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="yinOctaveJumpCorrection"
                className="ml-2 text-xs font-medium text-gray-300"
              >
                Octave Jump Correction
              </label>
            </div>

            <div>
              <label
                htmlFor="yinOctaveRatioThreshold"
                className="block mb-2 text-xs font-medium text-gray-300"
              >
                Octave Ratio Threshold
              </label>
              <input
                type="range"
                id="yinOctaveRatioThreshold"
                min="0.05"
                max="0.5"
                step="0.01"
                value={yinParams.octaveRatioThreshold}
                onChange={handleFloatChange("octaveRatioThreshold", false)}
                className="w-full"
              />
              <div className="text-xs text-gray-400 text-center mt-1">
                {yinParams.octaveRatioThreshold.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

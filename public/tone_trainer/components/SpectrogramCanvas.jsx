import React, { useRef, useEffect } from "react";
import { useToneAnalyzer } from "../context/ToneAnalyzerContext.jsx";
import { getColor } from "../utils/colorUtils.js";
import { FFT_SIZE, MAX_FREQ_HZ } from "../utils/constants.js";

export function SpectrogramCanvas() {
  const canvasRef = useRef(null);
  const { spectrogramData, settings, audioContext } = useToneAnalyzer();

  useEffect(() => {
    if (!canvasRef.current || spectrogramData.length === 0 || !audioContext) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const numSlices = spectrogramData.length;

    // Calculate frequency bins to show
    const freqPerBin = audioContext.sampleRate / FFT_SIZE;
    const relevantBins = Math.ceil(MAX_FREQ_HZ / freqPerBin);
    const totalBins = spectrogramData[0].length;
    const finalBinsToDraw = Math.min(relevantBins, totalBins);

    canvas.width = numSlices;
    canvas.height = finalBinsToDraw;

    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const value = spectrogramData[x][y];
        const color = getColor(value, settings.colorScheme);

        let r =
          settings.contrast * (color[0] - 128) + 128 + settings.brightness;
        let g =
          settings.contrast * (color[1] - 128) + 128 + settings.brightness;
        let b =
          settings.contrast * (color[2] - 128) + 128 + settings.brightness;

        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        const pixelIndex = ((canvas.height - 1 - y) * canvas.width + x) * 4;
        data[pixelIndex] = r;
        data[pixelIndex + 1] = g;
        data[pixelIndex + 2] = b;
        data[pixelIndex + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [spectrogramData, settings, audioContext]);

  return (
    <canvas
      ref={canvasRef}
      id="spectrogramCanvas"
      className="w-full h-[300px] bg-gray-900 rounded-lg"
      style={{
        imageRendering: "pixelated",
      }}
    />
  );
}

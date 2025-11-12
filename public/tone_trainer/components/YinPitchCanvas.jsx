import React, { useRef, useEffect } from "react";
import { useToneAnalyzer } from "../context/ToneAnalyzerContext.jsx";
import { getPitchPointColor } from "../utils/colorUtils.js";
import { medianFilter, correctOctaveJumps } from "../utils/pitchProcessing.js";
import {
  FFT_SIZE,
  YIN_MAX_JUMP_THRESHOLD_PERCENT,
  YIN_PITCH_POINT_RADIUS,
  YIN_PITCH_LINE_WIDTH,
} from "../utils/constants.js";

export function YinPitchCanvas() {
  const canvasRef = useRef(null);
  const { yinData, lastAudioBuffer, yinParams } = useToneAnalyzer();

  useEffect(() => {
    if (!canvasRef.current || yinData.length === 0 || !lastAudioBuffer) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Get display dimensions
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const pixelRatio = window.devicePixelRatio || 1;

    // Set high-resolution canvas dimensions
    canvas.width = displayWidth * pixelRatio;
    canvas.height = displayHeight * pixelRatio;

    // Scale context for high-DPI rendering
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const width = displayWidth;
    const height = displayHeight;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Apply median filter
    const smoothedYinData = medianFilter(yinData, yinParams.medianFilterWindowSize);

    // Apply octave jump correction if enabled
    const displayData = yinParams.octaveJumpCorrection
      ? correctOctaveJumps(smoothedYinData, yinParams)
      : smoothedYinData;

    const validPitches = displayData.filter((frame) => frame.pitch > 0);
    if (validPitches.length > 0) {
      const minPitch = Math.min(
        yinParams.minFreq,
        ...validPitches.map((f) => f.pitch)
      );
      const maxPitch = Math.max(...validPitches.map((f) => f.pitch));
      const pitchRange = Math.max(maxPitch - minPitch, 50);

      ctx.lineWidth = 2 * YIN_PITCH_LINE_WIDTH;

      const maxJumpThreshold = height * YIN_MAX_JUMP_THRESHOLD_PERCENT;

      const sampleRate = lastAudioBuffer.sampleRate;
      const totalDuration = lastAudioBuffer.duration;

      const spectrogramDelay = FFT_SIZE / 2;

      let lastValidX = -1;
      let lastValidY = -1;
      let lastValidAlpha = -1;

      for (let i = 0; i < displayData.length; i++) {
        const frame = displayData[i];
        if (frame.pitch > 0) {
          const frameStartSample = i * yinParams.hopSize;
          const frameCenterSample = frameStartSample + yinParams.frameSize / 2;

          const adjustedSample = frameCenterSample + spectrogramDelay;
          const timeInSeconds = adjustedSample / sampleRate;

          const x = (timeInSeconds / totalDuration) * width;

          const pitchRatio = (frame.pitch - minPitch) / pitchRange;
          const y = height - pitchRatio * height;

          const alpha = frame.confidence;
          const correction = frame.correction || "none";
          const pointColor = getPitchPointColor(correction, alpha);

          ctx.fillStyle = pointColor;

          // Draw line connecting consecutive valid pitch points
          if (lastValidX >= 0 && lastValidY >= 0) {
            const verticalJump = Math.abs(y - lastValidY);

            if (verticalJump < maxJumpThreshold) {
              const strokeAlpha = Math.min(lastValidAlpha, frame.confidence);
              const strokeColor = getPitchPointColor(correction, strokeAlpha);
              ctx.strokeStyle = strokeColor;

              ctx.beginPath();
              ctx.moveTo(lastValidX, lastValidY);
              ctx.lineTo(x, y);
              ctx.stroke();
            }
          }

          ctx.beginPath();
          ctx.arc(x, y, YIN_PITCH_POINT_RADIUS, 0, 2 * Math.PI);
          ctx.fill();

          lastValidX = x;
          lastValidY = y;
          lastValidAlpha = alpha;
        } else {
          lastValidX = -1;
          lastValidY = -1;
        }
      }

      // Draw pitch range labels
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "12px Inter";
      ctx.textAlign = "left";
      ctx.fillText(`${Math.round(maxPitch)}Hz`, 5, 20);
      ctx.fillText(`${Math.round(minPitch)}Hz`, 5, height - 10);
    } else {
      ctx.fillStyle = "#9CA3AF";
      ctx.font = "14px Inter";
      ctx.textAlign = "center";
      ctx.fillText("No pitch detected", width / 2, height / 2);
    }
  }, [yinData, lastAudioBuffer, yinParams]);

  return (
    <canvas
      ref={canvasRef}
      id="yinPitchCanvas"
      className="absolute top-0 left-0 pointer-events-none w-full h-[300px]"
      style={{ background: "transparent" }}
    />
  );
}

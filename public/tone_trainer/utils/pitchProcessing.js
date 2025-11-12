/**
 * Applies a median filter to an array of pitch data.
 */
export function medianFilter(data, windowSize) {
  if (windowSize % 2 === 0 || windowSize < 1) {
    throw new Error("Window size must be an odd positive number.");
  }
  const halfWindow = Math.floor(windowSize / 2);
  const filteredData = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length, i + halfWindow + 1);

    const window = data.slice(start, end).filter((frame) => frame.pitch > 0);

    if (window.length === 0) {
      filteredData.push(data[i]);
      continue;
    }

    window.sort((a, b) => a.pitch - b.pitch);
    const medianFrame = window[Math.floor(window.length / 2)];

    filteredData.push({
      ...data[i],
      pitch: medianFrame.pitch,
    });
  }
  return filteredData;
}

/**
 * Helper function to detect octave jump between two pitches
 */
export function detectOctaveJump(pitch1, pitch2, threshold, minFreq, maxFreq) {
  if (pitch1 === 0 || pitch2 === 0) return null;

  const ratio = pitch2 / pitch1;

  // Check for octave jump up (ratio ~2.0)
  if (Math.abs(ratio - 2.0) < threshold) {
    const correctedPitch = pitch2 / 2;
    if (correctedPitch >= minFreq && correctedPitch <= maxFreq) {
      return { pitch: correctedPitch, correction: "down_2x" };
    }
  }
  // Check for octave jump down (ratio ~0.5)
  if (Math.abs(ratio - 0.5) < threshold) {
    const correctedPitch = pitch2 * 2;
    if (correctedPitch >= minFreq && correctedPitch <= maxFreq) {
      return { pitch: correctedPitch, correction: "up_2x" };
    }
  }
  // Check for double octave jump up (ratio ~4.0)
  if (Math.abs(ratio - 4.0) < threshold) {
    const correctedPitch = pitch2 / 4;
    if (correctedPitch >= minFreq && correctedPitch <= maxFreq) {
      return { pitch: correctedPitch, correction: "down_4x" };
    }
  }
  // Check for double octave jump down (ratio ~0.25)
  if (Math.abs(ratio - 0.25) < threshold) {
    const correctedPitch = pitch2 * 4;
    if (correctedPitch >= minFreq && correctedPitch <= maxFreq) {
      return { pitch: correctedPitch, correction: "up_4x" };
    }
  }

  return null;
}

/**
 * Two-pass bidirectional octave jump correction
 */
export function correctOctaveJumps(pitchData, yinParams) {
  if (pitchData.length === 0) return [];

  const octaveRatioThreshold = yinParams.octaveRatioThreshold;
  const minFreq = yinParams.minFreq;
  const maxFreq = yinParams.maxFreq;

  const forwardCorrections = new Array(pitchData.length).fill(null);
  const backwardCorrections = new Array(pitchData.length).fill(null);

  // Forward pass
  const forwardData = pitchData.map((f) => ({ ...f }));
  for (let i = 1; i < forwardData.length; i++) {
    if (forwardData[i].pitch === 0 || forwardData[i - 1].pitch === 0) continue;

    const jump = detectOctaveJump(
      forwardData[i - 1].pitch,
      forwardData[i].pitch,
      octaveRatioThreshold,
      minFreq,
      maxFreq
    );
    if (jump) {
      forwardCorrections[i] = jump;
      forwardData[i].pitch = jump.pitch;
    }
  }

  // Backward pass
  const backwardData = pitchData.map((f) => ({ ...f }));
  for (let i = backwardData.length - 2; i >= 0; i--) {
    if (backwardData[i].pitch === 0 || backwardData[i + 1].pitch === 0)
      continue;

    const jump = detectOctaveJump(
      backwardData[i + 1].pitch,
      backwardData[i].pitch,
      octaveRatioThreshold,
      minFreq,
      maxFreq
    );
    if (jump) {
      backwardCorrections[i] = jump;
      backwardData[i].pitch = jump.pitch;
    }
  }

  // Apply only corrections that both passes agree on
  const correctedData = pitchData.map((frame, i) => {
    const fwd = forwardCorrections[i];
    const bwd = backwardCorrections[i];

    if (fwd && bwd && fwd.correction === bwd.correction) {
      return {
        ...frame,
        pitch: fwd.pitch,
        correction: fwd.correction,
      };
    }

    return {
      ...frame,
      correction: "none",
    };
  });

  return correctedData;
}

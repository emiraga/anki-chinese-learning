// DOM Elements
const instructions = document.getElementById("instructions");
const statusDiv = document.getElementById("status");
const statusSpinner = document.getElementById("statusSpinner");
const canvas = document.getElementById("spectrogramCanvas");
const canvasCtx = canvas.getContext("2d");
const progressLine = document.getElementById("progressLine");
const yinPitchCanvas = document.getElementById("yinPitchCanvas");
const yinPitchCanvasCtx = yinPitchCanvas.getContext("2d");
const controls = document.getElementById("controls");
const playButton = document.getElementById("playButton");
const playStopButton = document.getElementById("playStopButton");
const playIcon = document.getElementById("playIcon");
const stopIcon = document.getElementById("stopIcon");
const colorSchemeSelect = document.getElementById("colorScheme");
const brightnessSlider = document.getElementById("brightness");
const contrastSlider = document.getElementById("contrast");
const yinPitchLoadingOverlay = document.getElementById(
  "yinPitchLoadingOverlay",
);
const yinControlsSection = document.getElementById("yinControlsSection");
const dropZone = document.getElementById("dropZone");
const dropOverlay = document.getElementById("dropOverlay");
const saveAudioButton = document.getElementById("saveAudioButton");

// Audio & State Variables
let audioContext;
let mediaRecorder;
let isRecording = false;
let audioChunks = [];
let spectrogramData = [];
let yinData = [];
let lastAudioBuffer = null;
let currentAudioSource = null;
let isPlaying = false;
let progressAnimationFrame = null;
let audioStartTime = null;
let audioDuration = null;

// Audio recording sample rate (48000 Hz is high quality, standard for pro audio)
const RECORDING_SAMPLE_RATE = 48000;

// Visualization Settings
let settings = {
  colorScheme: "viridis",
  brightness: -75,
  contrast: 1.5,
};

// Recording Settings
let recordingSettings = {
  sampleRate: 48000,
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

// YIN Algorithm Parameters
let yinParams = {
  frameSize: 2048, // Window size for analysis
  hopSize: 256, // Step size between frames
  threshold: 0.3, // Absolute threshold for period detection
  fallbackThreshold: 0.8, // Fallback threshold for adaptive method
  minFreq: 30, // Minimum frequency to consider (Hz)
  maxFreq: 400, // Maximum frequency to consider (Hz)
  interpolation: true, // Enable parabolic interpolation
  differenceMethod: "fftZeroPadding", // Difference function method: "simple", "fftSimple", or "fftZeroPadding"
  thresholdMethod: "adaptive", // Threshold method: "simple", "adaptive"
  powerConfidenceAdjust: true,
  minPowerThreshold: 0.02, // Power threshold below which confidence is reduced
  octaveJumpCorrection: false, // Enable octave jump correction
  octaveRatioThreshold: 0.1, // Tolerance for octave detection (0-1)
  medianFilterWindowSize: 5, // Median filter window size for smoothing pitch data (must be odd)
};

// --- ANALYSIS CONSTANTS (EDITED FOR HIGHER RESOLUTION) ---
// Increased FFT_SIZE for better frequency (vertical) resolution.
const FFT_SIZE = 4096 * 2;
// The maximum frequency (in Hz) to display. This focuses the view on the vocal range.
const MAX_FREQ_HZ = 1300;
// is about how often we do the analysis. The system collects audio into a buffer, and every time the buffer is full, it runs the analysis.
const BUFFER_SIZE = 256;

// --- UI CONSTANTS ---
// Maximum vertical jump threshold as percentage of canvas height for YIN pitch chart
const YIN_MAX_JUMP_THRESHOLD_PERCENT = 0.1;
// Pitch point radius in pixels for YIN pitch visualization
const YIN_PITCH_POINT_RADIUS = 3;
// Line width for YIN pitch chart
const YIN_PITCH_LINE_WIDTH = 3;

// --- COLOR MAPS ---
const COLOR_MAPS = {
  viridis: [
    [68, 1, 84],
    [72, 40, 120],
    [62, 74, 137],
    [49, 104, 142],
    [38, 130, 142],
    [31, 158, 137],
    [53, 183, 121],
    [109, 205, 89],
    [180, 222, 44],
    [253, 231, 37],
  ],
  plasma: [
    [13, 8, 135],
    [72, 1, 163],
    [120, 1, 168],
    [163, 29, 151],
    [201, 62, 122],
    [230, 99, 90],
    [249, 139, 64],
    [254, 183, 43],
    [240, 226, 33],
  ],
  hot: [
    [0, 0, 0],
    [255, 0, 0],
    [255, 255, 0],
    [255, 255, 255],
  ],
  grayscale: [
    [0, 0, 0],
    [255, 255, 255],
  ],
};

function interpolateColor(c1, c2, factor) {
  const result = c1.slice();
  for (let i = 0; i < 3; i++) {
    result[i] = Math.round(result[i] + factor * (c2[i] - result[i]));
  }
  return result;
}

function getColor(value, schemeName) {
  const map = COLOR_MAPS[schemeName];
  const scaledValue = (value / 255) * (map.length - 1);
  const colorIndex = Math.floor(scaledValue);
  const factor = scaledValue - colorIndex;

  if (colorIndex >= map.length - 1) {
    return map[map.length - 1];
  }
  return interpolateColor(map[colorIndex], map[colorIndex + 1], factor);
}

// --- YIN ALGORITHM IMPLEMENTATION ---

/**
 * Calculate RMS (Root Mean Square) power of an audio frame
 * This gives us a measure of the signal strength/loudness
 * @param frame Audio frame buffer
 * @returns RMS power value (0 to 1 range typically)
 */
function calculateRMSPower(frame) {
  let sumSquares = 0;
  for (let i = 0; i < frame.length; i++) {
    sumSquares += frame[i] * frame[i];
  }
  return Math.sqrt(sumSquares / frame.length);
}

/**
 * Adjust confidence based on audio power
 * Low power signals are less reliable for pitch detection
 * @param confidence Original confidence value (0-1)
 * @param power RMS power of the frame
 * @returns Adjusted confidence value
 */
function adjustConfidenceByPower(confidence, power) {
  if (power < yinParams.minPowerThreshold) {
    return 0;
  }
  return confidence;
}

function yinDifferenceFunction(buffer) {
  const bufferSize = buffer.length;
  const differenceFunction = new Array(bufferSize / 2);

  // Step 1: Difference function d_t(τ) = Σ(x_j - x_{j+τ})²
  for (let tau = 0; tau < bufferSize / 2; tau++) {
    let sum = 0;
    for (let j = 0; j < bufferSize / 2; j++) {
      const delta = buffer[j] - buffer[j + tau];
      sum += delta * delta;
    }
    differenceFunction[tau] = sum;
  }

  return differenceFunction;
}

/**
 * Calculates the YIN difference function using an FFT-based approach
 * for improved performance.
 * @param buffer The audio frame buffer.
 * @returns The difference function array.
 */
function yinDifferenceFunctionFFTSimple(buffer) {
  const bufferSize = buffer.length;
  const halfBufferSize = bufferSize / 2;
  const differenceFunction = new Array(halfBufferSize).fill(0);

  // 1. Pad buffer to next power of 2 for FFT
  const fftSize = 1 << Math.ceil(Math.log2(bufferSize));
  const fft = new FFTJS(fftSize);

  const paddedBuffer = new Float32Array(fftSize);
  paddedBuffer.set(buffer);

  // 2. Compute FFT
  const fftResult = fft.createComplexArray();
  fft.realTransform(fftResult, paddedBuffer);

  // 3. Calculate Power Spectral Density (PSD)
  const psd = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i += 2) {
    const real = fftResult[i];
    const imag = fftResult[i + 1];
    psd[i / 2] = real * real + imag * imag;
  }

  // 4. Compute IFFT of PSD to get autocorrelation
  const autocorrelationComplex = fft.createComplexArray();
  // We need to transform the real-valued PSD into a complex format for IFFT
  for (let i = 0; i < psd.length; i++) {
    autocorrelationComplex[i * 2] = psd[i];
    autocorrelationComplex[i * 2 + 1] = 0;
  }
  const autocorrelationResult = fft.createComplexArray();
  fft.inverseTransform(autocorrelationResult, autocorrelationComplex);

  // 5. Calculate the difference function from autocorrelation
  // d(τ) ≈ 2 * (r(0) - r(τ))
  // We only need the real part of the autocorrelation
  const r0 = autocorrelationResult[0];
  for (let tau = 1; tau < halfBufferSize; tau++) {
    differenceFunction[tau] = r0 - autocorrelationResult[tau * 2];
  }

  // The difference function at tau=0 is 0
  differenceFunction[0] = 0;

  return differenceFunction;
}

/**
 * Calculates the YIN difference function using a corrected FFT-based approach
 * with sufficient zero-padding for linear correlation.
 */
function yinDifferenceFunctionFftZeroPadding(buffer) {
  const N = buffer.length; // Original buffer size
  const halfBufferSize = N / 2;
  const differenceFunction = new Array(halfBufferSize).fill(0); // 1. Correct Zero-Padding: Pad to next power of 2 >= 2*N - 1

  const requiredSize = 2 * N - 1;
  const fftSize = 1 << Math.ceil(Math.log2(requiredSize)); // M: Smallest power of 2 >= 2*N - 1
  // Initialize the FFT library with the new, larger size
  const fft = new FFTJS(fftSize); // Create a padded buffer (padded with zeros)

  const paddedBuffer = new Float32Array(fftSize);
  paddedBuffer.set(buffer); // 2. Compute FFT

  const fftResult = fft.createComplexArray();
  fft.realTransform(fftResult, paddedBuffer); // 3. Calculate Power Spectral Density (PSD)

  const psd = new Float32Array(fftSize / 2); // PSD is symmetric, only need first half
  for (let i = 0; i < fftSize; i += 2) {
    const real = fftResult[i];
    const imag = fftResult[i + 1];
    psd[i / 2] = real * real + imag * imag;
  } // 4. Compute IFFT of PSD to get autocorrelation

  const autocorrelationComplex = fft.createComplexArray(); // Transform the real-valued PSD into a complex format for IFFT
  for (let i = 0; i < psd.length; i++) {
    autocorrelationComplex[i * 2] = psd[i];
    autocorrelationComplex[i * 2 + 1] = 0;
  }
  const autocorrelationResult = fft.createComplexArray();
  fft.inverseTransform(autocorrelationResult, autocorrelationComplex); // 5. Calculate the difference function from autocorrelation
  // The IFFT results are scaled by 1/fftSize. This should be accounted for.

  const scaleFactor = 1.0 / fftSize; // r(0) is the first (real) element, scaled
  const r0 = autocorrelationResult[0] * scaleFactor;
  differenceFunction[0] = 0; // d(0) is 0

  for (let tau = 1; tau < halfBufferSize; tau++) {
    // r(tau) is the real part of the tau-th element, scaled
    const r_tau = autocorrelationResult[tau * 2] * scaleFactor; // Use the approximation d(τ) ≈ 2 * (r(0) - r(τ))
    differenceFunction[tau] = 2.0 * (r0 - r_tau);
  }

  return differenceFunction;
}

function yinCumulativeMeanNormalizedDifference(differenceFunction) {
  const cmndf = new Array(differenceFunction.length);
  cmndf[0] = 1;

  // Step 2: Cumulative mean normalized difference function
  // d'_t(τ) = { 1 if τ = 0
  //           { d_t(τ) / ((1/τ) * Σ_{j=1}^τ d_t(j)) if τ ≠ 0
  let runningSum = 0;
  for (let tau = 1; tau < differenceFunction.length; tau++) {
    runningSum += differenceFunction[tau];
    cmndf[tau] = differenceFunction[tau] / (runningSum / tau);
  }

  return cmndf;
}

function yinAbsoluteThresholdSimple(cmndf, threshold, sampleRate) {
  // Step 3: Absolute threshold
  // Find the first minimum below the threshold
  for (let tau = 2; tau < cmndf.length; tau++) {
    if (cmndf[tau] < threshold) {
      // Check if this is a local minimum
      while (tau + 1 < cmndf.length && cmndf[tau + 1] < cmndf[tau]) {
        tau++;
      }
      return tau;
    }
  }
  return -1; // No period found
}

/**
 * Adaptive threshold approach: Finds the best pitch candidate using multiple strategies
 * 1. Look for deepest minimum below threshold (original behavior)
 * 2. If no candidate found, find global minimum within valid frequency range
 * 3. Use a dynamic threshold based on signal characteristics
 */
function yinAbsoluteThresholdAdaptive(cmndf, threshold, sampleRate) {
  const minTau = Math.floor(sampleRate / yinParams.maxFreq);
  const maxTau = Math.floor(sampleRate / yinParams.minFreq);

  // Clamp search range to valid indices
  const startTau = Math.max(2, minTau);
  const endTau = Math.min(cmndf.length - 1, maxTau);

  // Strategy 1: Find deepest minimum below threshold within frequency range
  let bestTau = -1;
  let bestValue = threshold;

  for (let tau = startTau; tau < endTau; tau++) {
    if (cmndf[tau] < bestValue) {
      // Check if this is a local minimum
      const isLocalMin =
        (tau === startTau || cmndf[tau] <= cmndf[tau - 1]) &&
        (tau === endTau - 1 || cmndf[tau] <= cmndf[tau + 1]);

      if (isLocalMin) {
        bestValue = cmndf[tau];
        bestTau = tau;
      }
    }
  }

  // Strategy 2: If no candidate below threshold, find global minimum
  // but only accept if it's reasonably good (< 0.5 which indicates some periodicity)
  if (bestTau === -1) {
    let globalMinTau = -1;
    let globalMinValue = 1.0;

    for (let tau = startTau; tau < endTau; tau++) {
      // Check if this is a local minimum
      const isLocalMin =
        (tau === startTau || cmndf[tau] <= cmndf[tau - 1]) &&
        (tau === endTau - 1 || cmndf[tau] <= cmndf[tau + 1]);

      if (isLocalMin && cmndf[tau] < globalMinValue) {
        globalMinValue = cmndf[tau];
        globalMinTau = tau;
      }
    }

    // Only accept global minimum if it shows reasonable periodicity
    if (globalMinValue < yinParams.fallbackThreshold) {
      bestTau = globalMinTau;
    }
  }

  return bestTau;
}

/**
 * An alternative YIN thresholding method that finds the *first* local minimum
 * below the specified threshold. This is often more robust against octave-up errors
 * for signals with strong harmonics.
 *
 * @param {number[]} cmndf The Cumulative Mean Normalized Difference Function.
 * @param {number} threshold The primary threshold for accepting a pitch candidate (e.g., 0.1 to 0.3).
 * @param {number} sampleRate The sample rate of the audio.
 * @returns {number} The estimated period (tau), or -1 if no suitable period is found.
 */
function yinAbsoluteThresholdFirstDip(cmndf, threshold, sampleRate) {
  const minTau = Math.floor(sampleRate / yinParams.maxFreq);
  const maxTau = Math.floor(sampleRate / yinParams.minFreq);

  // Clamp search range to valid indices, skipping the first two elements.
  const startTau = Math.max(2, minTau);
  const endTau = Math.min(cmndf.length - 1, maxTau);

  // --- Strategy 1: Find the *first* local minimum that drops below the threshold. ---
  // A local minimum is a point lower than its immediate neighbors.
  for (let tau = startTau; tau < endTau; tau++) {
    const isLocalMinimum =
      cmndf[tau] < cmndf[tau - 1] && cmndf[tau] <= cmndf[tau + 1];

    if (isLocalMinimum && cmndf[tau] < threshold) {
      return tau; // Success! We found the first good candidate.
    }
  }

  // --- Strategy 2 (Fallback): If no candidate was found above. ---
  // The signal might be unvoiced or the fundamental is very weak.
  // We'll find the single deepest dip in the entire range and accept it
  // only if it's below a more lenient `fallbackThreshold`.
  let globalMinTau = -1;
  let globalMinValue = 1.0;

  for (let tau = startTau; tau < endTau; tau++) {
    if (cmndf[tau] < globalMinValue) {
      globalMinValue = cmndf[tau];
      globalMinTau = tau;
    }
  }

  // Only accept the global minimum if it shows a reasonable amount of periodicity.
  if (globalMinValue < yinParams.fallbackThreshold) {
    return globalMinTau;
  }

  // If all else fails, report no pitch found.
  return -1;
}

function yinParabolicInterpolation(cmndf, tauEstimate) {
  // Step 4: Parabolic interpolation for better accuracy
  if (tauEstimate < 1 || tauEstimate >= cmndf.length - 1) {
    return tauEstimate;
  }

  const s0 = cmndf[tauEstimate - 1];
  const s1 = cmndf[tauEstimate];
  const s2 = cmndf[tauEstimate + 1];

  // Parabolic interpolation formula
  const betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
  return betterTau;
}

// Mapping of threshold method names to functions
const yinThresholdMethods = {
  simple: yinAbsoluteThresholdSimple,
  adaptive: yinAbsoluteThresholdAdaptive,
  firstDip: yinAbsoluteThresholdFirstDip,
};

// Mapping of difference function method names to functions
const yinDifferenceMethods = {
  simple: yinDifferenceFunction,
  fftSimple: yinDifferenceFunctionFFTSimple,
  fftZeroPadding: yinDifferenceFunctionFftZeroPadding,
};

function performYinAnalysis(audioBuffer, frameSize, hopSize) {
  // Use parameters from yinParams if not provided
  frameSize = frameSize || yinParams.frameSize;
  hopSize = hopSize || yinParams.hopSize;

  const sampleRate = audioBuffer.sampleRate;
  const audioData = audioBuffer.getChannelData(0);
  const yinResults = [];

  // Performance tracking
  const analysisStartTime = performance.now();
  let frameCount = 0;

  // Select difference function based on method
  const useDifferenceFunction =
    yinDifferenceMethods[yinParams.differenceMethod] ||
    yinDifferenceFunctionFftZeroPadding;

  // Process audio in overlapping frames
  for (let i = 0; i <= audioData.length - frameSize; i += hopSize) {
    const frame = audioData.slice(i, i + frameSize);

    // Step 1: Difference function
    const differenceFunction = useDifferenceFunction(frame);
    frameCount++;

    // Step 2: Cumulative mean normalized difference function
    const cmndf = yinCumulativeMeanNormalizedDifference(differenceFunction);

    // Step 3: Absolute threshold using selected method
    const thresholdFunction =
      yinThresholdMethods[yinParams.thresholdMethod] ||
      yinAbsoluteThresholdAdaptive;
    let tauEstimate = thresholdFunction(cmndf, yinParams.threshold, sampleRate);

    let pitch = 0;
    let confidence = 0;

    if (tauEstimate > 0) {
      // Step 4: Parabolic interpolation (if enabled)
      const betterTau = yinParams.interpolation
        ? yinParabolicInterpolation(cmndf, tauEstimate)
        : tauEstimate;

      // Convert tau to frequency
      pitch = sampleRate / betterTau;

      // Confidence is inverse of CMNDF value at the estimated tau
      confidence = 1 - cmndf[Math.round(betterTau)];

      // Filter out unrealistic pitches using dynamic parameters
      if (pitch < yinParams.minFreq || pitch > yinParams.maxFreq) {
        pitch = 0;
        confidence = 0;
      }
    }

    if (yinParams.powerConfidenceAdjust) {
      // Calculate RMS power of the frame
      const framePower = calculateRMSPower(frame);

      // Apply power-based confidence adjustment
      // Low power signals are less reliable for pitch detection
      if (confidence > 0) {
        confidence = adjustConfidenceByPower(confidence, framePower);
      }
    }

    yinResults.push({
      pitch: pitch,
      confidence: confidence,
    });
  }

  // Store performance data
  const totalTime = performance.now() - analysisStartTime;
  console.log(
    `YIN Performance: ${yinParams.differenceMethod} - Total=${totalTime.toFixed(1)}ms, Frames=${frameCount}`,
  );

  return yinResults;
}

// --- HELPER FUNCTIONS ---
// DOM visibility helpers
function show(element) {
  element.classList.remove("hidden");
}

function hide(element) {
  element.classList.add("hidden");
}

// Overlay-specific visibility helpers (need flex)
function showOverlay(element) {
  element.classList.remove("hidden");
  element.classList.add("flex");
}

function hideOverlay(element) {
  element.classList.add("hidden");
  element.classList.remove("flex");
}

// Status message helpers
function setStatus(message, options = {}) {
  const {
    backgroundColor = null,
    isLoading = false,
    spinnerColor = "border-blue-300",
  } = options;

  // Update message text
  instructions.textContent = message;

  // Show/hide spinner
  if (isLoading) {
    // Update spinner color
    replaceClasses(
      statusSpinner,
      ["border-blue-300", "border-purple-300", "border-green-300"],
      [spinnerColor],
    );
    show(statusSpinner);
  } else {
    hide(statusSpinner);
  }

  show(statusDiv);

  if (backgroundColor) {
    statusDiv.style.backgroundColor = backgroundColor;
  }
}

function hideStatus() {
  hide(statusDiv);
}

// Controls visibility
function showControls() {
  show(controls);
  show(playButton);
  show(yinControlsSection);
}

// Progress line helpers
function showProgressLine() {
  show(progressLine);
  progressLine.style.left = "0%";
}

function hideProgressLine() {
  hide(progressLine);
}

function updateProgressLine(percentage) {
  progressLine.style.left = percentage + "%";
}

// Text content helpers
function setText(elementId, text) {
  document.getElementById(elementId).textContent = text;
}

// Class manipulation helpers
function replaceClasses(element, removeClasses, addClasses) {
  element.classList.remove(...removeClasses);
  element.classList.add(...addClasses);
}

// Play/Stop button state management
function showPlayingState() {
  hide(playIcon);
  show(stopIcon);
  playStopButton.title = "Stop audio";
  replaceClasses(
    playStopButton,
    ["bg-blue-600", "hover:bg-blue-500"],
    ["bg-red-600", "hover:bg-red-500"],
  );
}

function showStoppedState() {
  show(playIcon);
  hide(stopIcon);
  playStopButton.title = "Play audio";
  replaceClasses(
    playStopButton,
    ["bg-red-600", "hover:bg-red-500"],
    ["bg-blue-600", "hover:bg-blue-500"],
  );
}

// --- DISPLAY CONTROLS TOGGLE ---
function toggleDisplayControls() {
  const displayControls = document.getElementById("displayControlsContent");
  const chevron = document.getElementById("displayControlsChevron");

  if (displayControls.classList.contains("hidden")) {
    // Show controls
    displayControls.classList.remove("hidden");
    displayControls.classList.add("grid");
    chevron.style.transform = "rotate(180deg)";
  } else {
    // Hide controls
    displayControls.classList.remove("grid");
    displayControls.classList.add("hidden");
    chevron.style.transform = "rotate(0deg)";
  }
}

// --- YIN CONTROLS TOGGLE ---
function toggleYinControls() {
  const yinControls = document.getElementById("yinControls");
  const chevron = document.getElementById("yinControlsChevron");

  if (yinControls.classList.contains("hidden")) {
    // Show controls
    yinControls.classList.remove("hidden");
    yinControls.classList.add("grid");
    chevron.style.transform = "rotate(180deg)";
  } else {
    // Hide controls
    yinControls.classList.remove("grid");
    yinControls.classList.add("hidden");
    chevron.style.transform = "rotate(0deg)";
  }
}

// --- RECORDING CONTROLS TOGGLE ---
function toggleRecordingControls() {
  const recordingControls = document.getElementById("recordingControlsContent");
  const chevron = document.getElementById("recordingControlsChevron");

  if (recordingControls.classList.contains("hidden")) {
    // Show controls
    recordingControls.classList.remove("hidden");
    recordingControls.classList.add("grid");
    chevron.style.transform = "rotate(180deg)";
  } else {
    // Hide controls
    recordingControls.classList.remove("grid");
    recordingControls.classList.add("hidden");
    chevron.style.transform = "rotate(0deg)";
  }
}

// --- EVENT LISTENERS ---
window.addEventListener("load", () => {
  hide(controls);
  hide(playButton);
  hideStatus();
  loadAudioFile("audio/ai_讀書寫字.mp3");
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault(); // Always prevent space bar scrolling
    if (!isRecording) {
      startRecording();
    }
  } else if (e.code === "Enter" || e.code === "NumpadEnter") {
    e.preventDefault(); // Prevent form submission or other default behavior
    if (lastAudioBuffer && !isRecording) {
      togglePlayStop();
    }
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    e.preventDefault(); // Always prevent space bar scrolling
    stopRecording();
  }
});

window.addEventListener("blur", () => {
  stopRecording();
});

window.addEventListener("resize", () => {
  if (spectrogramData.length > 0) {
    drawSpectrogram();
    drawYinPitchChart();
  }
});

// --- DRAG AND DROP EVENT LISTENERS ---
// Counter to track drag enter/leave events for proper overlay handling
let dragCounter = 0;

document.body.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  showOverlay(dropOverlay);
});

document.body.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.body.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter--;
  // Only hide when all drag events have left
  if (dragCounter === 0) {
    hideOverlay(dropOverlay);
  }
});

document.body.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter = 0;
  hideOverlay(dropOverlay);

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    // Check if it's an audio file
    if (file.type.startsWith("audio/")) {
      loadDroppedAudio(file);
    } else {
      setStatus("Please drop an audio file (MP3, WAV, OGG, M4A)", {
        backgroundColor: "#d97706",
      });
    }
  }
});

// Generic handler for control setup and updates
function setupControl(elementOrId, paramsObject, paramKey, config = {}) {
  const {
    eventType = "change",
    parser = (target) => target.value,
    displayElementId = null,
    formatter = (v) => v,
    onChange = null,
  } = config;

  // Support both element and elementId
  const element =
    typeof elementOrId === "string"
      ? document.getElementById(elementOrId)
      : elementOrId;

  const initialValue = paramsObject[paramKey];

  // Initialize the element with the value from params
  if (element.type === "checkbox") {
    element.checked = initialValue;
  } else {
    element.value = initialValue;
  }

  // Initialize display value if provided
  if (displayElementId) {
    setText(displayElementId, formatter(initialValue));
  }

  // Set up event listener for changes
  element.addEventListener(eventType, (e) => {
    const value = parser(e.target);
    paramsObject[paramKey] = value;

    if (displayElementId) {
      setText(displayElementId, formatter(value));
    }

    // Call optional callback
    if (onChange) {
      onChange();
    }
  });
}

// Helper function to redraw visualizations if data exists
function redrawIfDataExists() {
  if (spectrogramData.length > 0) {
    drawSpectrogram();
    drawYinPitchChart();
  }
}

// Setup all display controls
setupControl(colorSchemeSelect, settings, "colorScheme", {
  onChange: redrawIfDataExists,
});

setupControl(brightnessSlider, settings, "brightness", {
  eventType: "input",
  parser: (t) => parseInt(t.value, 10),
  displayElementId: "brightnessValue",
  onChange: redrawIfDataExists,
});

setupControl(contrastSlider, settings, "contrast", {
  eventType: "input",
  parser: (t) => parseFloat(t.value),
  displayElementId: "contrastValue",
  formatter: (v) => v.toFixed(1),
  onChange: redrawIfDataExists,
});

// --- RECORDING SETTINGS CONTROLS ---
setupControl("recordingSampleRate", recordingSettings, "sampleRate", {
  parser: (t) => parseInt(t.value, 10),
});

setupControl("recordingChannelCount", recordingSettings, "channelCount", {
  parser: (t) => parseInt(t.value, 10),
});

setupControl(
  "recordingEchoCancellation",
  recordingSettings,
  "echoCancellation",
  {
    parser: (t) => t.checked,
  },
);

setupControl(
  "recordingNoiseSuppression",
  recordingSettings,
  "noiseSuppression",
  {
    parser: (t) => t.checked,
  },
);

setupControl("recordingAutoGainControl", recordingSettings, "autoGainControl", {
  parser: (t) => t.checked,
});

// --- YIN PARAMETER EVENT LISTENERS ---
function recomputeYin() {
  if (lastAudioBuffer && yinData.length > 0) {
    showYinPitchLoadingOverlay();
    // Use setTimeout to allow browser to repaint and show the overlay
    setTimeout(() => {
      yinData = performYinAnalysis(lastAudioBuffer);
      drawYinPitchChart();
      hideYinPitchLoadingOverlay();
    }, 10);
  }
}

function showYinPitchLoadingOverlay() {
  showOverlay(yinPitchLoadingOverlay);
}

function hideYinPitchLoadingOverlay() {
  hideOverlay(yinPitchLoadingOverlay);
}

// Setup all YIN parameter controls
setupControl("yinFrameSize", yinParams, "frameSize", {
  parser: (t) => parseInt(t.value, 10),
  onChange: recomputeYin,
});

setupControl("yinHopSize", yinParams, "hopSize", {
  parser: (t) => parseInt(t.value, 10),
  onChange: recomputeYin,
});

setupControl("yinThresholdSlider", yinParams, "threshold", {
  eventType: "input",
  parser: (t) => parseFloat(t.value),
  displayElementId: "yinThresholdValue",
  formatter: (v) => v.toFixed(2),
  onChange: recomputeYin,
});

setupControl("yinFallbackThresholdSlider", yinParams, "fallbackThreshold", {
  eventType: "input",
  parser: (t) => parseFloat(t.value),
  displayElementId: "yinFallbackThresholdValue",
  formatter: (v) => v.toFixed(2),
  onChange: recomputeYin,
});

setupControl("yinMinFreqSlider", yinParams, "minFreq", {
  eventType: "input",
  parser: (t) => parseInt(t.value, 10),
  displayElementId: "yinMinFreqValue",
  onChange: recomputeYin,
});

setupControl("yinMaxFreqSlider", yinParams, "maxFreq", {
  eventType: "input",
  parser: (t) => parseInt(t.value, 10),
  displayElementId: "yinMaxFreqValue",
  onChange: recomputeYin,
});

setupControl("yinInterpolation", yinParams, "interpolation", {
  parser: (t) => t.checked,
  onChange: recomputeYin,
});

setupControl("yinDifferenceMethod", yinParams, "differenceMethod", {
  onChange: recomputeYin,
});

setupControl("yinThresholdMethod", yinParams, "thresholdMethod", {
  onChange: recomputeYin,
});

setupControl("yinPowerConfidenceAdjust", yinParams, "powerConfidenceAdjust", {
  parser: (t) => t.checked,
  onChange: recomputeYin,
});

setupControl("yinMinPowerThresholdSlider", yinParams, "minPowerThreshold", {
  eventType: "input",
  parser: (t) => parseFloat(t.value),
  displayElementId: "yinMinPowerThresholdValue",
  formatter: (v) => v.toFixed(3),
  onChange: recomputeYin,
});

setupControl("yinOctaveJumpCorrection", yinParams, "octaveJumpCorrection", {
  parser: (t) => t.checked,
  onChange: () => {
    // Only redraw, no need to recompute YIN
    if (spectrogramData.length > 0) {
      drawYinPitchChart();
    }
  },
});

setupControl(
  "yinMedianFilterWindowSizeSlider",
  yinParams,
  "medianFilterWindowSize",
  {
    eventType: "input",
    parser: (t) => parseInt(t.value, 10),
    displayElementId: "yinMedianFilterWindowSizeValue",
    onChange: () => {
      // Only redraw, no need to recompute YIN
      if (spectrogramData.length > 0) {
        drawYinPitchChart();
      }
    },
  },
);

setupControl(
  "yinOctaveRatioThresholdSlider",
  yinParams,
  "octaveRatioThreshold",
  {
    eventType: "input",
    parser: (t) => parseFloat(t.value),
    displayElementId: "yinOctaveRatioThresholdValue",
    formatter: (v) => v.toFixed(2),
    onChange: () => {
      // Only redraw, no need to recompute YIN
      if (spectrogramData.length > 0) {
        drawYinPitchChart();
      }
    },
  },
);

// --- CORE AUDIO FUNCTIONS ---

/**
 * Convert AudioBuffer to WAV format
 * @param audioBuffer The AudioBuffer to convert
 * @returns Blob containing WAV data
 */
function audioBufferToWav(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numberOfChannels * 2;
  const sampleRate = audioBuffer.sampleRate;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  // Write WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true); // byte rate
  view.setUint16(32, numberOfChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, length, true);

  // Write audio data
  const channels = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Save the current audio buffer as a WAV file
 */
function saveAudioFile() {
  if (!lastAudioBuffer) {
    alert("No audio loaded to save");
    return;
  }

  try {
    // Convert to WAV
    const wavBlob = audioBufferToWav(lastAudioBuffer);

    // Create download link
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tone_recording_${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("Audio file saved successfully");
  } catch (err) {
    console.error("Error saving audio file:", err);
    alert("Error saving audio file: " + err.message);
  }
}

/**
 * Ensures AudioContext is initialized with proper sample rate
 */
function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: RECORDING_SAMPLE_RATE,
    });
  }
  return audioContext;
}

/**
 * Common workflow for processing audio buffer:
 * - Performs YIN analysis
 * - Generates spectrogram
 * - Updates UI
 * - Auto-plays audio
 */
async function processAudioBuffer(audioBuffer) {
  // Store for replay
  lastAudioBuffer = audioBuffer;

  // Initialize data arrays
  yinData = [];

  // Update status for YIN analysis
  setStatus("Computing YIN pitch analysis...", {
    isLoading: true,
    spinnerColor: "border-purple-300",
  });

  // Perform YIN analysis
  yinData = performYinAnalysis(audioBuffer);

  // Update status for spectrogram
  setStatus("Generating spectrogram...", {
    isLoading: true,
    spinnerColor: "border-green-300",
  });

  // Analyze and draw visualizations
  analyzeAndDraw(audioBuffer);

  hideStatus();

  // Show controls and play button
  showControls();

  // Enable save button
  saveAudioButton.disabled = false;

  // Auto-play the audio
  playLastRecording();
}

async function startRecording() {
  if (isRecording) {
    return;
  }
  isRecording = true;
  audioChunks = [];

  try {
    // Ensure AudioContext is created by user gesture with high sample rate
    ensureAudioContext();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: recordingSettings.channelCount },
        sampleRate: { ideal: recordingSettings.sampleRate },
        echoCancellation: recordingSettings.echoCancellation,
        noiseSuppression: recordingSettings.noiseSuppression,
        autoGainControl: recordingSettings.autoGainControl,
        latency: 0, // Request lowest possible latency
      },
    });
    if (!stream) {
      return;
    }
    if (!isRecording) {
      stream.getAudioTracks().forEach((track) => track.stop());
      return;
    }
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.onstart = (event) => {
      setStatus("Recording...", { backgroundColor: "#ef4444" });
    };
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    mediaRecorder.onstop = processAudio;
    mediaRecorder.start();
  } catch (err) {
    console.error("Error accessing microphone:", err);
    setStatus("Microphone access denied. Please allow access and try again.", {
      backgroundColor: "#d97706",
    });
    isRecording = false;
  }
}

function stopRecording() {
  if (!isRecording) {
    return;
  }
  isRecording = false;
  if (!mediaRecorder) {
    return;
  }
  mediaRecorder.stop();

  // Clean up media stream tracks
  if (mediaRecorder.stream) {
    mediaRecorder.stream.getTracks().forEach((track) => track.stop());
  }

  setStatus("Analyzing...", { backgroundColor: "#3b82f6" });
  showYinPitchLoadingOverlay();
}

function processAudio() {
  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const audioBuffer = await audioContext.decodeAudioData(e.target.result);
      hideYinPitchLoadingOverlay();
      await processAudioBuffer(audioBuffer);
    } catch (err) {
      console.error("Error decoding audio data:", err);
      setStatus("Could not process audio. Please try again.");
    }
  };
  reader.readAsArrayBuffer(audioBlob);
}

async function playAudio(audioBuffer) {
  // Stop any currently playing audio and clear existing animation frame
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
    } catch (e) {
      // Ignore errors if source already stopped
    }
  }
  if (progressAnimationFrame) {
    cancelAnimationFrame(progressAnimationFrame);
    progressAnimationFrame = null;
  }

  // Resume AudioContext if suspended (required for some browsers)
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  // Show progress line
  showProgressLine();

  audioDuration = audioBuffer.duration;

  currentAudioSource = source;
  isPlaying = true;
  updatePlayStopButton();

  // Use performance.now() for more accurate progress tracking
  let playbackStartTime = null;

  // Start progress tracking using requestAnimationFrame for smooth updates
  function updateProgress() {
    if (!isPlaying) {
      progressAnimationFrame = null;
      return;
    }

    // Initialize start time on first frame (when audio has actually started)
    if (playbackStartTime === null) {
      playbackStartTime = performance.now();
    }

    // Calculate elapsed time in seconds using high-resolution timer
    const elapsed = (performance.now() - playbackStartTime) / 1000;
    const progress = Math.min((elapsed / audioDuration) * 100, 100);

    updateProgressLine(progress);

    if (progress >= 100 || elapsed >= audioDuration) {
      isPlaying = false;
      currentAudioSource = null;
      updatePlayStopButton();
      updateProgressLine(100);
      progressAnimationFrame = null;
      // Keep progress line visible briefly after completion
      setTimeout(() => {
        if (!isPlaying) {
          hideProgressLine();
        }
      }, 1000);
    } else {
      progressAnimationFrame = requestAnimationFrame(updateProgress);
    }
  }

  source.onended = () => {
    if (progressAnimationFrame) {
      cancelAnimationFrame(progressAnimationFrame);
      progressAnimationFrame = null;
    }
    isPlaying = false;
    currentAudioSource = null;
    updatePlayStopButton();
    hideProgressLine();
  };

  // Start the audio immediately
  source.start(0);

  // Start the progress animation
  progressAnimationFrame = requestAnimationFrame(updateProgress);
}

function playLastRecording() {
  if (lastAudioBuffer && audioContext) {
    playAudio(lastAudioBuffer);
  }
}

function stopPlayback() {
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
    } catch (e) {
      // Ignore errors if source already stopped
    }
    currentAudioSource = null;
  }
  if (progressAnimationFrame) {
    cancelAnimationFrame(progressAnimationFrame);
    progressAnimationFrame = null;
  }
  isPlaying = false;
  hideProgressLine();
  updatePlayStopButton();
}

function togglePlayStop() {
  if (isPlaying) {
    stopPlayback();
  } else {
    playLastRecording();
  }
}

function updatePlayStopButton() {
  if (isPlaying) {
    showPlayingState();
  } else {
    showStoppedState();
  }
}

async function loadDroppedAudio(file) {
  try {
    // Stop any currently playing audio
    if (isPlaying) {
      stopPlayback();
    }

    // Show loading indicator
    setStatus("Processing audio file...", {
      backgroundColor: "#3b82f6",
      isLoading: true,
      spinnerColor: "border-blue-300",
    });

    // Initialize audio context
    ensureAudioContext();

    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();

    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Process the audio buffer (YIN analysis, spectrogram, UI updates, auto-play)
    await processAudioBuffer(audioBuffer);
  } catch (err) {
    console.error("Error loading dropped audio:", err);
    setStatus(
      "Could not process audio file. Make sure it's a valid audio format.",
      {
        backgroundColor: "#d97706",
      },
    );
  }
}

async function loadAudioFile(filePath, needMaxFreq = null) {
  try {
    // Stop any currently playing audio
    if (isPlaying) {
      stopPlayback();
    }

    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Adjust Max Freq if a minimum is specified and current value is lower
    if (needMaxFreq !== null && yinParams.maxFreq !== needMaxFreq) {
      yinParams.maxFreq = needMaxFreq;
      document.getElementById("yinMaxFreqSlider").value = needMaxFreq;
      setText("yinMaxFreqValue", needMaxFreq.toString());
    }

    // Show loading indicator
    setStatus("Loading audio file...", {
      backgroundColor: "#3b82f6",
      isLoading: true,
      spinnerColor: "border-blue-300",
    });

    // Initialize audio context
    ensureAudioContext();

    // Fetch the audio file
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load audio file: ${response.statusText}`);
    }

    // Read as array buffer
    const arrayBuffer = await response.arrayBuffer();

    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Process the audio buffer (YIN analysis, spectrogram, UI updates, auto-play)
    await processAudioBuffer(audioBuffer);
  } catch (err) {
    console.error("Error loading audio file:", err);
    setStatus("Could not load audio file. Please try again.", {
      backgroundColor: "#d97706",
    });
  }
}

function analyzeAndDraw(audioBuffer) {
  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate,
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  const analyser = offlineCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE; // Use the new higher resolution FFT size
  analyser.smoothingTimeConstant = 0;

  // Decreased buffer size for better time (horizontal) resolution.
  const bufferSize = BUFFER_SIZE;
  const processor = offlineCtx.createScriptProcessor(bufferSize, 1, 1);

  const freqData = new Uint8Array(analyser.frequencyBinCount);
  spectrogramData = [];

  processor.onaudioprocess = (e) => {
    analyser.getByteFrequencyData(freqData);
    spectrogramData.push(new Uint8Array(freqData));
  };

  source.connect(analyser);
  analyser.connect(processor);
  processor.connect(offlineCtx.destination);

  source.start(0);

  offlineCtx
    .startRendering()
    .then(() => {
      hideStatus();
      showControls();

      drawSpectrogram();
      drawYinPitchChart();
    })
    .catch((err) => {
      console.error("Offline rendering failed:", err);
      setStatus("Error during analysis.");
    });
}

function drawSpectrogram() {
  const numSlices = spectrogramData.length;
  if (numSlices === 0) return;

  // --- EDITED FOR FOCUSED VIEW ---
  // Calculate how many frequency bins to show to focus on the vocal range.
  const freqPerBin = audioContext.sampleRate / FFT_SIZE;
  const relevantBins = Math.ceil(MAX_FREQ_HZ / freqPerBin);
  const totalBins = spectrogramData[0].length;
  const finalBinsToDraw = Math.min(relevantBins, totalBins);

  canvas.width = numSlices;
  canvas.height = finalBinsToDraw;

  const imageData = canvasCtx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;

  for (let x = 0; x < canvas.width; x++) {
    for (let y = 0; y < canvas.height; y++) {
      const value = spectrogramData[x][y];
      const color = getColor(value, settings.colorScheme);

      let r = settings.contrast * (color[0] - 128) + 128 + settings.brightness;
      let g = settings.contrast * (color[1] - 128) + 128 + settings.brightness;
      let b = settings.contrast * (color[2] - 128) + 128 + settings.brightness;

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
  canvasCtx.putImageData(imageData, 0, 0);
}

/**
 * Applies a median filter to an array of pitch data.
 * @param {Array<{pitch: number, confidence: number}>} data The input array of YIN frames.
 * @param {number} windowSize The size of the filter window (must be an odd number, e.g., 3 or 5).
 * @returns {Array<{pitch: number, confidence: number}>} The filtered data.
 */
function medianFilter(data, windowSize) {
  if (windowSize % 2 === 0 || windowSize < 1) {
    throw new Error("Window size must be an odd positive number.");
  }
  const halfWindow = Math.floor(windowSize / 2);
  const filteredData = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length, i + halfWindow + 1);

    // Get the window of frames and filter out zero-pitch (unvoiced) frames
    const window = data.slice(start, end).filter((frame) => frame.pitch > 0);

    if (window.length === 0) {
      // If no valid pitches in window, keep the original frame
      filteredData.push(data[i]);
      continue;
    }

    // Sort by pitch to find the median
    window.sort((a, b) => a.pitch - b.pitch);
    const medianFrame = window[Math.floor(window.length / 2)];

    // Create a new frame using the median pitch but retaining the original's confidence
    filteredData.push({
      ...data[i],
      pitch: medianFrame.pitch,
    });
  }
  return filteredData;
}

/**
 * Helper function to detect octave jump between two pitches
 * Returns correction info if jump detected, null otherwise
 * Ensures corrected pitch stays within minFreq and maxFreq boundaries
 */
function detectOctaveJump(pitch1, pitch2, threshold) {
  if (pitch1 === 0 || pitch2 === 0) return null;

  const ratio = pitch2 / pitch1;
  const minFreq = yinParams.minFreq;
  const maxFreq = yinParams.maxFreq;

  // Check for octave jump up (ratio ~2.0) - pitch2 was too high, should divide by 2
  if (Math.abs(ratio - 2.0) < threshold) {
    const correctedPitch = pitch2 / 2;
    // Only apply correction if it stays within valid frequency range
    if (correctedPitch >= minFreq && correctedPitch <= maxFreq) {
      return { pitch: correctedPitch, correction: "down_2x" };
    }
  }
  // Check for octave jump down (ratio ~0.5) - pitch2 was too low, should multiply by 2
  if (Math.abs(ratio - 0.5) < threshold) {
    const correctedPitch = pitch2 * 2;
    // Only apply correction if it stays within valid frequency range
    if (correctedPitch >= minFreq && correctedPitch <= maxFreq) {
      return { pitch: correctedPitch, correction: "up_2x" };
    }
  }
  // Check for double octave jump up (ratio ~4.0)
  if (Math.abs(ratio - 4.0) < threshold) {
    const correctedPitch = pitch2 / 4;
    // Only apply correction if it stays within valid frequency range
    if (correctedPitch >= minFreq && correctedPitch <= maxFreq) {
      return { pitch: correctedPitch, correction: "down_4x" };
    }
  }
  // Check for double octave jump down (ratio ~0.25)
  if (Math.abs(ratio - 0.25) < threshold) {
    const correctedPitch = pitch2 * 4;
    // Only apply correction if it stays within valid frequency range
    if (correctedPitch >= minFreq && correctedPitch <= maxFreq) {
      return { pitch: correctedPitch, correction: "up_4x" };
    }
  }

  return null;
}

/**
 * Two-pass bidirectional octave jump correction
 * Pass 1: Forward (left-to-right) - marks potential corrections
 * Pass 2: Backward (right-to-left) - marks potential corrections
 * Only apply corrections that both passes agree on
 */
function correctOctaveJumps(pitchData) {
  if (pitchData.length === 0) return [];

  const octaveRatioThreshold = yinParams.octaveRatioThreshold;

  // Initialize forward and backward correction arrays
  const forwardCorrections = new Array(pitchData.length).fill(null);
  const backwardCorrections = new Array(pitchData.length).fill(null);

  // Pass 1: Forward pass (left-to-right)
  const forwardData = pitchData.map((f) => ({ ...f }));
  for (let i = 1; i < forwardData.length; i++) {
    if (forwardData[i].pitch === 0 || forwardData[i - 1].pitch === 0) continue;

    const jump = detectOctaveJump(
      forwardData[i - 1].pitch,
      forwardData[i].pitch,
      octaveRatioThreshold,
    );
    if (jump) {
      forwardCorrections[i] = jump;
      forwardData[i].pitch = jump.pitch; // Apply correction for next comparison
    }
  }

  // Pass 2: Backward pass (right-to-left)
  const backwardData = pitchData.map((f) => ({ ...f }));
  for (let i = backwardData.length - 2; i >= 0; i--) {
    if (backwardData[i].pitch === 0 || backwardData[i + 1].pitch === 0)
      continue;

    const jump = detectOctaveJump(
      backwardData[i + 1].pitch,
      backwardData[i].pitch,
      octaveRatioThreshold,
    );
    if (jump) {
      backwardCorrections[i] = jump;
      backwardData[i].pitch = jump.pitch; // Apply correction for next comparison
    }
  }

  // Pass 3: Apply only corrections that both passes agree on
  const correctedData = pitchData.map((frame, i) => {
    const fwd = forwardCorrections[i];
    const bwd = backwardCorrections[i];

    // Both passes must agree on the correction type
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

/**
 * Get color for a pitch point based on correction type
 * @param correction The correction type: 'none', 'up_2x', 'down_2x', 'up_4x', 'down_4x'
 * @param alpha The alpha/opacity value
 * @returns CSS color string
 */
function getPitchPointColor(correction, alpha) {
  if (!correction || correction === "none") {
    // White for uncorrected points
    return `rgba(255, 255, 255, ${alpha})`;
  }

  switch (correction) {
    case "up_2x":
      // Light red for 2x upward correction
      return `rgba(255, 100, 100, ${alpha})`;
    case "up_4x":
      // Bright red for 4x upward correction
      return `rgba(255, 50, 50, ${alpha})`;
    case "down_2x":
      // Light blue for 2x downward correction
      return `rgba(100, 150, 255, ${alpha})`;
    case "down_4x":
      // Bright blue for 4x downward correction
      return `rgba(50, 100, 255, ${alpha})`;
    default:
      return `rgba(255, 255, 255, ${alpha})`;
  }
}

function drawYinPitchChart() {
  if (yinData.length === 0) return;
  if (!lastAudioBuffer) return;

  // Get display dimensions from CSS
  const displayWidth = yinPitchCanvas.clientWidth;
  const displayHeight = yinPitchCanvas.clientHeight;
  const pixelRatio = window.devicePixelRatio || 1;

  // Set high-resolution canvas dimensions
  yinPitchCanvas.width = displayWidth * pixelRatio;
  yinPitchCanvas.height = displayHeight * pixelRatio;

  // Scale context for high-DPI rendering
  yinPitchCanvasCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const ctx = yinPitchCanvasCtx;
  const width = displayWidth;
  const height = displayHeight;

  // Clear canvas with transparent background
  ctx.clearRect(0, 0, width, height);

  // 1. Apply Median Filter first to smooth out single-frame outliers
  const smoothedYinData = medianFilter(
    yinData,
    yinParams.medianFilterWindowSize,
  );

  // Apply octave jump correction to the data if enabled
  const displayData = yinParams.octaveJumpCorrection
    ? correctOctaveJumps(smoothedYinData)
    : smoothedYinData;

  const validPitches = displayData.filter((frame) => frame.pitch > 0);
  if (validPitches.length > 0) {
    const minPitch = Math.min(
      yinParams.minFreq,
      ...validPitches.map((f) => f.pitch),
    );
    const maxPitch = Math.max(...validPitches.map((f) => f.pitch));
    const pitchRange = Math.max(maxPitch - minPitch, 50);

    // Draw pitch line with confidence-based opacity
    ctx.lineWidth = 2 * YIN_PITCH_LINE_WIDTH;

    // Maximum vertical jump threshold
    const maxJumpThreshold = height * YIN_MAX_JUMP_THRESHOLD_PERCENT;

    // Calculate time-based alignment with spectrogram
    const sampleRate = lastAudioBuffer.sampleRate;
    const totalDuration = lastAudioBuffer.duration;

    // The spectrogram uses FFT analysis with a window, creating a delay
    // Account for spectrogram's FFT window delay (FFT_SIZE/2)
    const spectrogramDelay = FFT_SIZE / 2;

    let lastValidX = -1;
    let lastValidY = -1;
    let lastValidAlpha = -1;

    for (let i = 0; i < displayData.length; i++) {
      const frame = displayData[i];
      if (frame.pitch > 0) {
        // Calculate actual time position of this YIN frame
        // Frame starts at sample: i * hopSize
        // YIN frames are centered at their midpoint: i * hopSize + frameSize/2
        const frameStartSample = i * yinParams.hopSize;
        const frameCenterSample = frameStartSample + yinParams.frameSize / 2;

        // Adjust for spectrogram's FFT delay to align properly
        const adjustedSample = frameCenterSample + spectrogramDelay;
        const timeInSeconds = adjustedSample / sampleRate;

        // Map time to canvas width to align with spectrogram
        const x = (timeInSeconds / totalDuration) * width;

        // Map pitch to independent Y-axis (full canvas height for pitch range)
        const pitchRatio = (frame.pitch - minPitch) / pitchRange;
        const y = height - pitchRatio * height;

        // Color based on confidence and correction type
        const alpha = frame.confidence;
        const correction = frame.correction || "none";
        const pointColor = getPitchPointColor(correction, alpha);

        ctx.fillStyle = pointColor;

        // Draw line connecting consecutive valid pitch points only if jump is small enough
        if (lastValidX >= 0 && lastValidY >= 0) {
          const verticalJump = Math.abs(y - lastValidY);

          // Only draw connecting line if the jump is below threshold
          if (verticalJump < maxJumpThreshold) {
            // Use average of current and previous point colors for the connecting line
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
        // Reset line drawing when pitch is invalid
        lastValidX = -1;
        lastValidY = -1;
      }
    }

    // Draw pitch range labels on the overlay
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
}

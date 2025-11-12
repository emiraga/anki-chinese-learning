// YIN Algorithm Implementation
import type { PitchFrame, YinParams } from "./pitchProcessing";

// Declare FFTJS type for the global library loaded from fftjs.min.js
declare const FFTJS: {
  new (size: number): {
    createComplexArray(): Float32Array;
    realTransform(out: Float32Array, data: Float32Array): void;
    inverseTransform(out: Float32Array, data: Float32Array): void;
  };
};

/**
 * Calculate RMS (Root Mean Square) power of an audio frame
 */
export function calculateRMSPower(frame: Float32Array): number {
  let sumSquares = 0;
  for (let i = 0; i < frame.length; i++) {
    sumSquares += frame[i] * frame[i];
  }
  return Math.sqrt(sumSquares / frame.length);
}

/**
 * Adjust confidence based on audio power
 */
export function adjustConfidenceByPower(
  confidence: number,
  power: number,
  minPowerThreshold: number
): number {
  if (power < minPowerThreshold) {
    return 0;
  }
  return confidence;
}

export function yinDifferenceFunction(buffer: Float32Array): number[] {
  const bufferSize = buffer.length;
  const differenceFunction = new Array(bufferSize / 2);

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

export function yinDifferenceFunctionFFTSimple(buffer: Float32Array): number[] {
  const bufferSize = buffer.length;
  const halfBufferSize = bufferSize / 2;
  const differenceFunction = new Array(halfBufferSize).fill(0);

  const fftSize = 1 << Math.ceil(Math.log2(bufferSize));
  const fft = new FFTJS(fftSize);

  const paddedBuffer = new Float32Array(fftSize);
  paddedBuffer.set(buffer);

  const fftResult = fft.createComplexArray();
  fft.realTransform(fftResult, paddedBuffer);

  const psd = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i += 2) {
    const real = fftResult[i];
    const imag = fftResult[i + 1];
    psd[i / 2] = real * real + imag * imag;
  }

  const autocorrelationComplex = fft.createComplexArray();
  for (let i = 0; i < psd.length; i++) {
    autocorrelationComplex[i * 2] = psd[i];
    autocorrelationComplex[i * 2 + 1] = 0;
  }
  const autocorrelationResult = fft.createComplexArray();
  fft.inverseTransform(autocorrelationResult, autocorrelationComplex);

  const r0 = autocorrelationResult[0];
  for (let tau = 1; tau < halfBufferSize; tau++) {
    differenceFunction[tau] = r0 - autocorrelationResult[tau * 2];
  }

  differenceFunction[0] = 0;

  return differenceFunction;
}

export function yinDifferenceFunctionFftZeroPadding(buffer: Float32Array): number[] {
  const N = buffer.length;
  const halfBufferSize = N / 2;
  const differenceFunction = new Array(halfBufferSize).fill(0);

  const requiredSize = 2 * N - 1;
  const fftSize = 1 << Math.ceil(Math.log2(requiredSize));
  const fft = new FFTJS(fftSize);

  const paddedBuffer = new Float32Array(fftSize);
  paddedBuffer.set(buffer);

  const fftResult = fft.createComplexArray();
  fft.realTransform(fftResult, paddedBuffer);

  const psd = new Float32Array(fftSize / 2);
  for (let i = 0; i < fftSize; i += 2) {
    const real = fftResult[i];
    const imag = fftResult[i + 1];
    psd[i / 2] = real * real + imag * imag;
  }

  const autocorrelationComplex = fft.createComplexArray();
  for (let i = 0; i < psd.length; i++) {
    autocorrelationComplex[i * 2] = psd[i];
    autocorrelationComplex[i * 2 + 1] = 0;
  }
  const autocorrelationResult = fft.createComplexArray();
  fft.inverseTransform(autocorrelationResult, autocorrelationComplex);

  const scaleFactor = 1.0 / fftSize;
  const r0 = autocorrelationResult[0] * scaleFactor;
  differenceFunction[0] = 0;

  for (let tau = 1; tau < halfBufferSize; tau++) {
    const rTau = autocorrelationResult[tau * 2] * scaleFactor;
    differenceFunction[tau] = 2.0 * (r0 - rTau);
  }

  return differenceFunction;
}

export function yinCumulativeMeanNormalizedDifference(differenceFunction: number[]): number[] {
  const cmndf = new Array(differenceFunction.length);
  cmndf[0] = 1;

  let runningSum = 0;
  for (let tau = 1; tau < differenceFunction.length; tau++) {
    runningSum += differenceFunction[tau];
    cmndf[tau] = differenceFunction[tau] / (runningSum / tau);
  }

  return cmndf;
}

export function yinAbsoluteThresholdSimple(cmndf: number[], threshold: number): number {
  for (let tau = 2; tau < cmndf.length; tau++) {
    if (cmndf[tau] < threshold) {
      while (tau + 1 < cmndf.length && cmndf[tau + 1] < cmndf[tau]) {
        tau++;
      }
      return tau;
    }
  }
  return -1;
}

export function yinAbsoluteThresholdAdaptive(
  cmndf: number[],
  threshold: number,
  sampleRate: number,
  yinParams: YinParams
): number {
  const minTau = Math.floor(sampleRate / yinParams.maxFreq);
  const maxTau = Math.floor(sampleRate / yinParams.minFreq);

  const startTau = Math.max(2, minTau);
  const endTau = Math.min(cmndf.length - 1, maxTau);

  let bestTau = -1;
  let bestValue = threshold;

  for (let tau = startTau; tau < endTau; tau++) {
    if (cmndf[tau] < bestValue) {
      const isLocalMin =
        (tau === startTau || cmndf[tau] <= cmndf[tau - 1]) &&
        (tau === endTau - 1 || cmndf[tau] <= cmndf[tau + 1]);

      if (isLocalMin) {
        bestValue = cmndf[tau];
        bestTau = tau;
      }
    }
  }

  if (bestTau === -1) {
    let globalMinTau = -1;
    let globalMinValue = 1.0;

    for (let tau = startTau; tau < endTau; tau++) {
      const isLocalMin =
        (tau === startTau || cmndf[tau] <= cmndf[tau - 1]) &&
        (tau === endTau - 1 || cmndf[tau] <= cmndf[tau + 1]);

      if (isLocalMin && cmndf[tau] < globalMinValue) {
        globalMinValue = cmndf[tau];
        globalMinTau = tau;
      }
    }

    if (globalMinValue < yinParams.fallbackThreshold) {
      bestTau = globalMinTau;
    }
  }

  return bestTau;
}

export function yinAbsoluteThresholdFirstDip(
  cmndf: number[],
  threshold: number,
  sampleRate: number,
  yinParams: YinParams
): number {
  const minTau = Math.floor(sampleRate / yinParams.maxFreq);
  const maxTau = Math.floor(sampleRate / yinParams.minFreq);

  const startTau = Math.max(2, minTau);
  const endTau = Math.min(cmndf.length - 1, maxTau);

  for (let tau = startTau; tau < endTau; tau++) {
    const isLocalMinimum =
      cmndf[tau] < cmndf[tau - 1] && cmndf[tau] <= cmndf[tau + 1];

    if (isLocalMinimum && cmndf[tau] < threshold) {
      return tau;
    }
  }

  let globalMinTau = -1;
  let globalMinValue = 1.0;

  for (let tau = startTau; tau < endTau; tau++) {
    if (cmndf[tau] < globalMinValue) {
      globalMinValue = cmndf[tau];
      globalMinTau = tau;
    }
  }

  if (globalMinValue < yinParams.fallbackThreshold) {
    return globalMinTau;
  }

  return -1;
}

export function yinParabolicInterpolation(cmndf: number[], tauEstimate: number): number {
  if (tauEstimate < 1 || tauEstimate >= cmndf.length - 1) {
    return tauEstimate;
  }

  const s0 = cmndf[tauEstimate - 1];
  const s1 = cmndf[tauEstimate];
  const s2 = cmndf[tauEstimate + 1];

  const betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
  return betterTau;
}

// Threshold method function type
type ThresholdMethodFn = (
  cmndf: number[],
  threshold: number,
  sampleRate: number,
  yinParams: YinParams
) => number;

// Difference method function type
type DifferenceMethodFn = (buffer: Float32Array) => number[];

// Mapping of methods
export const yinThresholdMethods: Record<string, ThresholdMethodFn> = {
  simple: yinAbsoluteThresholdSimple,
  adaptive: yinAbsoluteThresholdAdaptive,
  firstDip: yinAbsoluteThresholdFirstDip,
};

export const yinDifferenceMethods: Record<string, DifferenceMethodFn> = {
  simple: yinDifferenceFunction,
  fftSimple: yinDifferenceFunctionFFTSimple,
  fftZeroPadding: yinDifferenceFunctionFftZeroPadding,
};

export function performYinAnalysis(audioBuffer: AudioBuffer, yinParams: YinParams): PitchFrame[] {
  const { frameSize, hopSize } = yinParams;
  const sampleRate = audioBuffer.sampleRate;
  const audioData = audioBuffer.getChannelData(0);
  const yinResults: PitchFrame[] = [];

  const analysisStartTime = performance.now();
  let frameCount = 0;

  const calculateDifferenceFunction =
    yinDifferenceMethods[yinParams.differenceMethod] ||
    yinDifferenceFunctionFftZeroPadding;

  for (let i = 0; i <= audioData.length - frameSize; i += hopSize) {
    const frame = audioData.slice(i, i + frameSize);

    const differenceFunction = calculateDifferenceFunction(frame);
    frameCount++;

    const cmndf = yinCumulativeMeanNormalizedDifference(differenceFunction);

    const thresholdFunction =
      yinThresholdMethods[yinParams.thresholdMethod] ||
      yinAbsoluteThresholdAdaptive;
    let tauEstimate = thresholdFunction(
      cmndf,
      yinParams.threshold,
      sampleRate,
      yinParams
    );

    let pitch = 0;
    let confidence = 0;

    if (tauEstimate > 0) {
      const betterTau = yinParams.interpolation
        ? yinParabolicInterpolation(cmndf, tauEstimate)
        : tauEstimate;

      pitch = sampleRate / betterTau;

      confidence = 1 - cmndf[Math.round(betterTau)];

      if (pitch < yinParams.minFreq || pitch > yinParams.maxFreq) {
        pitch = 0;
        confidence = 0;
      }
    }

    if (yinParams.powerConfidenceAdjust) {
      const framePower = calculateRMSPower(frame);

      if (confidence > 0) {
        confidence = adjustConfidenceByPower(
          confidence,
          framePower,
          yinParams.minPowerThreshold
        );
      }
    }

    yinResults.push({
      pitch: pitch,
      confidence: confidence,
    });
  }

  const totalTime = performance.now() - analysisStartTime;
  console.log(
    `YIN Performance: ${yinParams.differenceMethod} - Total=${totalTime.toFixed(1)}ms, Frames=${frameCount}`
  );

  return yinResults;
}

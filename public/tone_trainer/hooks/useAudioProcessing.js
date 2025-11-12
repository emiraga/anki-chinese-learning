import { useCallback } from "react";
import { useToneAnalyzer } from "../context/ToneAnalyzerContext";
import { performYinAnalysis } from "../utils/yinAlgorithm";
import { FFT_SIZE, BUFFER_SIZE } from "../utils/constants";

export function useAudioProcessing() {
  const {
    audioContext,
    setSpectrogramData,
    setYinData,
    setLastAudioBuffer,
    setStatusMessage,
    yinParams,
  } = useToneAnalyzer();

  const generateSpectrogram = useCallback(
    (audioBuffer) => {
      return new Promise((resolve, reject) => {
        const offlineCtx = new OfflineAudioContext(
          audioBuffer.numberOfChannels,
          audioBuffer.length,
          audioBuffer.sampleRate
        );
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;

        const analyser = offlineCtx.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = 0;

        const bufferSize = BUFFER_SIZE;
        const processor = offlineCtx.createScriptProcessor(bufferSize, 1, 1);

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const spectrogramData = [];

        processor.onaudioprocess = () => {
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
            resolve(spectrogramData);
          })
          .catch((err) => {
            reject(err);
          });
      });
    },
    []
  );

  const processAudioBuffer = useCallback(
    async (audioBuffer) => {
      try {
        // Store for replay
        setLastAudioBuffer(audioBuffer);

        // Update status for YIN analysis
        setStatusMessage({
          text: "Computing YIN pitch analysis...",
          isLoading: true,
          spinnerColor: "border-purple-300",
        });

        // Perform YIN analysis
        const yinResults = performYinAnalysis(audioBuffer, yinParams);
        setYinData(yinResults);

        // Update status for spectrogram
        setStatusMessage({
          text: "Generating spectrogram...",
          isLoading: true,
          spinnerColor: "border-green-300",
        });

        // Generate spectrogram
        const spectrogramData = await generateSpectrogram(audioBuffer);
        setSpectrogramData(spectrogramData);

        // Clear status
        setStatusMessage(null);

        return true;
      } catch (err) {
        console.error("Error processing audio buffer:", err);
        setStatusMessage({
          text: "Could not process audio. Please try again.",
          isLoading: false,
          backgroundColor: "#d97706",
        });
        return false;
      }
    },
    [
      setLastAudioBuffer,
      setYinData,
      setSpectrogramData,
      setStatusMessage,
      yinParams,
      generateSpectrogram,
    ]
  );

  return {
    processAudioBuffer,
  };
}

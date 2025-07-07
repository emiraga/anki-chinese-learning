import React, { useState, useEffect, useCallback } from "react";
import { useSettings } from "~/settings/SettingsContext";

// Define the main App component
const App: React.FC = () => {
  // State variables for text input, audio URL, loading status, and error messages
  const [textInput, setTextInput] = useState<string>(
    "你好，這是一個台灣華語語音合成的範例。"
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State variables for voice and audio configuration
  const [selectedVoiceName, setSelectedVoiceName] =
    useState<string>("cmn-TW-Standard-A");
  const [selectedGender, setSelectedGender] = useState<
    "FEMALE" | "MALE" | "NEUTRAL"
  >("FEMALE");
  const [speakingRate, setSpeakingRate] = useState<number>(0.6);
  const [pitch, setPitch] = useState<number>(0.0);
  const [volumeGainDb, setVolumeGainDb] = useState<number>(0.0);
  const {
    settings: { googleCloudApiKey },
  } = useSettings();

  // List of available Taiwanese Mandarin voices (examples, you can expand this)
  const taiwaneseVoices = [
    { name: "cmn-TW-Standard-A", gender: "FEMALE" },
    { name: "cmn-TW-Standard-B", gender: "MALE" },
    { name: "cmn-TW-Standard-C", gender: "MALE" },
    { name: "cmn-TW-Standard-D", gender: "FEMALE" },
    { name: "cmn-TW-Wavenet-A", gender: "FEMALE" },
    { name: "cmn-TW-Wavenet-B", gender: "MALE" },
    { name: "cmn-TW-Wavenet-C", gender: "MALE" },
    { name: "cmn-TW-Wavenet-D", gender: "FEMALE" },
  ];

  // Function to synthesize speech using Google Cloud Text-to-Speech API
  const synthesizeSpeech = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAudioUrl(null); // Clear previous audio

    // Revoke previous object URL to prevent memory leaks
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    try {
      if (!textInput.trim()) {
        throw new Error("Please enter some text to synthesize.");
      }

      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleCloudApiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: { text: textInput },
            voice: {
              languageCode: "cmn-TW", // Taiwanese Mandarin
              name: selectedVoiceName,
              ssmlGender: selectedGender,
            },
            audioConfig: {
              audioEncoding: "MP3",
              speakingRate: speakingRate,
              pitch: pitch,
              volumeGainDb: volumeGainDb,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || "Failed to synthesize speech."
        );
      }

      const data = await response.json();

      if (data.audioContent) {
        // Decode base64 audio content
        const audioBlob = base64ToBlob(data.audioContent, "audio/mp3");
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      } else {
        throw new Error("No audio content received from the API.");
      }
    } catch (err: any) {
      console.error("Error synthesizing speech:", err);
      setError(err.message || "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  }, [
    textInput,
    selectedVoiceName,
    selectedGender,
    speakingRate,
    pitch,
    volumeGainDb,
    audioUrl,
    googleCloudApiKey,
  ]);

  // Utility function to convert base64 string to Blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  // Cleanup object URL when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-center text-gray-800 mb-6">
          Taiwanese Text-to-Speech
        </h1>

        {/* Text Input Section */}
        <div className="mb-6">
          <label
            htmlFor="textInput"
            className="block text-gray-700 text-sm font-medium mb-2"
          >
            Enter Text (Traditional Chinese):
          </label>
          <textarea
            id="textInput"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base resize-y min-h-[120px] shadow-sm"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="輸入您想轉換成語音的文字..."
            rows={5}
          />
        </div>

        {/* Voice and Audio Configuration Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Voice Name Selection */}
          <div>
            <label
              htmlFor="voiceName"
              className="block text-gray-700 text-sm font-medium mb-2"
            >
              Voice Name:
            </label>
            <select
              id="voiceName"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 shadow-sm"
              value={selectedVoiceName}
              onChange={(e) => setSelectedVoiceName(e.target.value)}
            >
              {taiwaneseVoices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} ({voice.gender})
                </option>
              ))}
            </select>
          </div>

          {/* Gender Selection */}
          <div>
            <label
              htmlFor="gender"
              className="block text-gray-700 text-sm font-medium mb-2"
            >
              Gender:
            </label>
            <select
              id="gender"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 shadow-sm"
              value={selectedGender}
              onChange={(e) =>
                setSelectedGender(
                  e.target.value as "FEMALE" | "MALE" | "NEUTRAL"
                )
              }
            >
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="NEUTRAL">Neutral</option>
            </select>
          </div>

          {/* Speaking Rate */}
          <div>
            <label
              htmlFor="speakingRate"
              className="block text-gray-700 text-sm font-medium mb-2"
            >
              Speaking Rate (0.25 - 4.0): {speakingRate.toFixed(2)}
            </label>
            <input
              id="speakingRate"
              type="range"
              min="0.25"
              max="4.0"
              step="0.05"
              value={speakingRate}
              onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500"
            />
          </div>

          {/* Pitch */}
          <div>
            <label
              htmlFor="pitch"
              className="block text-gray-700 text-sm font-medium mb-2"
            >
              Pitch (-20.0 - 20.0): {pitch.toFixed(1)}
            </label>
            <input
              id="pitch"
              type="range"
              min="-20.0"
              max="20.0"
              step="0.5"
              value={pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500"
            />
          </div>

          {/* Volume Gain */}
          <div>
            <label
              htmlFor="volumeGainDb"
              className="block text-gray-700 text-sm font-medium mb-2"
            >
              Volume Gain (-96.0 - 16.0 dB): {volumeGainDb.toFixed(1)}
            </label>
            <input
              id="volumeGainDb"
              type="range"
              min="-96.0"
              max="16.0"
              step="0.5"
              value={volumeGainDb}
              onChange={(e) => setVolumeGainDb(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500"
            />
          </div>
        </div>

        {/* Generate Speech Button */}
        <button
          onClick={synthesizeSpeech}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 shadow-md flex items-center justify-center"
          disabled={loading}
        >
          {loading ? (
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : (
            "Generate Speech"
          )}
        </button>

        {/* Loading and Error Messages */}
        {loading && (
          <p className="text-center text-blue-600 mt-4">Generating audio...</p>
        )}
        {error && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mt-4"
            role="alert"
          >
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {/* Audio Player */}
        {audioUrl && (
          <div className="mt-6 text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Play Audio:
            </h3>
            <audio
              controls
              src={audioUrl}
              className="w-full max-w-md mx-auto rounded-lg shadow-md"
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

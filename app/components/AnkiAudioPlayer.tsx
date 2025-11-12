import React, { useState, useRef, useCallback, useEffect } from "react";
import anki from "~/apis/anki";
import {
  ToneAnalyzerProvider,
  useToneAnalyzer,
} from "../../public/tone_trainer/context/ToneAnalyzerContext";
import { useAudioInstance } from "../../public/tone_trainer/hooks/useAudioInstance";
import { AudioVisualizerPanel } from "../../public/tone_trainer/components/AudioVisualizerPanel";
import { trimSilence } from "../../public/tone_trainer/utils/audioUtils";

interface AnkiAudioPlayerProps {
  audioField?: string;
  className?: string;
  pitchVisualisation?: boolean;
}

// Simple audio player (no visualization)
const SimpleAnkiAudioPlayer: React.FC<
  Omit<AnkiAudioPlayerProps, "pitchVisualisation">
> = ({ audioField, className }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const extractFilename = (audioField: string): string | null => {
    const match = audioField.match(/\[sound:([^\]]+)\]/);
    return match ? match[1] : null;
  };

  const loadAndPlayAudio = async () => {
    if (!audioField) {
      setError("Audio field is empty");
      return;
    }
    const filename = extractFilename(audioField);

    if (!filename) {
      setError("No audio filename found in the field");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Retrieve media file from Anki
      const mediaFile = await anki.media.retrieveMediaFile({
        filename: filename,
      });

      if (!mediaFile) {
        throw new Error("Audio file not found in Anki media collection");
      }

      // Convert base64 to blob and create URL
      const binaryString = atob(mediaFile);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      setAudioUrl(url);

      // Wait for audio to load and then play
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();

        audioRef.current.onloadeddata = () => {
          audioRef.current?.play();
          setIsPlaying(true);
          setIsLoading(false);
        };

        audioRef.current.onerror = () => {
          setError("Failed to load audio file");
          setIsLoading(false);
        };
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audio");
      setIsLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioUrl) {
        audioRef.current.play();
        setIsPlaying(true);
      } else {
        loadAndPlayAudio();
      }
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleAudioError = () => {
    setError("Audio playback failed");
    setIsPlaying(false);
    setIsLoading(false);
  };

  // Clean up URL when component unmounts
  React.useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  if (!audioField) {
    return undefined;
  }

  const filename = extractFilename(audioField);

  return (
    <span className={`w-4 ml-1 inline-block rounded-lg ${className}`}>
      <button
        onClick={handlePlayPause}
        disabled={isLoading || !filename}
        className={`
          flex items-center justify-center w-4 h-4 rounded-full transition-colors
          ${
            isLoading || !filename
              ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
              : "bg-blue-200 dark:bg-blue-700 hover:bg-blue-300 dark:hover:bg-blue-600 text-white"
          }
        `}
      >
        {isLoading ? "o" : "⏵"}
      </button>

      <div className="flex-1">
        {error && (
          <div className="flex items-center space-x-1 text-red-600 dark:text-red-400 text-xs mt-1">
            🛑 <span>{error}</span>
          </div>
        )}
      </div>

      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onError={handleAudioError}
        className="hidden"
      />
    </span>
  );
};

// Pitch visualization audio player
const PitchVisualizationPlayer: React.FC<
  Omit<AnkiAudioPlayerProps, "pitchVisualisation">
> = ({ audioField }) => {
  const { audioContext, ensureAudioContext, settings, setStatusMessage } =
    useToneAnalyzer();

  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = useCallback(
    (
      message: string,
      isLoading: boolean,
      backgroundColor?: string,
      spinnerColor?: string,
    ) => {
      if (message) {
        setStatusMessage({ message, isLoading, backgroundColor, spinnerColor });
      } else {
        setStatusMessage(null);
      }
    },
    [setStatusMessage],
  );

  const audioInstance = useAudioInstance(
    {
      id: "anki-audio",
      showYinControls: false,
      showRecordingControls: false,
    },
    audioContext,
    handleStatusChange,
  );

  const extractFilename = (audioField: string): string | null => {
    const match = audioField.match(/\[sound:([^\]]+)\]/);
    return match ? match[1] : null;
  };

  const loadAudio = useCallback(async () => {
    if (!audioField) {
      setError("Audio field is empty");
      return;
    }

    const filename = extractFilename(audioField);

    if (!filename) {
      setError("No audio filename found in the field");
      return;
    }

    try {
      audioInstance.stopPlayback();

      setStatusMessage({
        message: "Loading audio from Anki...",
        isLoading: true,
        spinnerColor: "border-blue-300",
        backgroundColor: "#3b82f6",
      });

      // Retrieve media file from Anki
      const mediaFile = await anki.media.retrieveMediaFile({
        filename: filename,
      });

      if (!mediaFile) {
        throw new Error("Audio file not found in Anki media collection");
      }

      // Convert base64 to arraybuffer
      const binaryString = atob(mediaFile);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const arrayBuffer = bytes.buffer;

      const ctx = ensureAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Trim silence from beginning and end
      const trimmedBuffer = trimSilence(audioBuffer);

      const processedBuffer =
        await audioInstance.processAudioBuffer(trimmedBuffer);
      audioInstance.playAudio(processedBuffer);
    } catch (err) {
      console.error("Error loading audio file:", err);
      setError(err instanceof Error ? err.message : "Failed to load audio");
      setStatusMessage({
        message: "Could not load audio file. Please try again.",
        isLoading: false,
        backgroundColor: "#d97706",
      });
    }
  }, [
    audioField,
    audioInstance,
    ensureAudioContext,
    setStatusMessage,
  ]);

  // Load audio on mount
  useEffect(() => {
    loadAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!audioField) {
    return undefined;
  }

  return (
    <div className="my-4 w-full">
      {error && (
        <div className="flex items-center space-x-1 text-red-600 dark:text-red-400 text-sm mb-2">
          🛑 <span>{error}</span>
        </div>
      )}

      <AudioVisualizerPanel
        instance={audioInstance.instance}
        audioContext={audioContext}
        visualizationSettings={settings}
        onPlayStop={audioInstance.togglePlayStop}
        onYinParamsChange={audioInstance.updateYinParams}
        onRecomputeYin={audioInstance.recomputeYin}
        showYinLoadingOverlay={audioInstance.yinLoading}
      />
    </div>
  );
};

// Main component that chooses which player to render
const AnkiAudioPlayer: React.FC<AnkiAudioPlayerProps> = ({
  audioField,
  className,
  pitchVisualisation = false,
}) => {
  if (!pitchVisualisation) {
    return <SimpleAnkiAudioPlayer audioField={audioField} className={className} />;
  }

  return (
    <ToneAnalyzerProvider>
      <PitchVisualizationPlayer audioField={audioField} />
    </ToneAnalyzerProvider>
  );
};

export default AnkiAudioPlayer;

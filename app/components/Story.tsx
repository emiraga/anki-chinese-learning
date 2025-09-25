import React, { useState } from "react";
import type { PhraseType } from "~/data/phrases";
import { pickRandomElements } from "~/utils/array";
import { useLocalStorageState } from "~/utils/localStorage";
import { useSettings } from "~/settings/SettingsContext";
import { useGenerativeModel } from "~/apis/google_genai";
import StoryReader from "./StoryReader";
import Textarea from "react-textarea-autosize";

const Story: React.FC<{
  phrases: PhraseType[];
  characterList: string[];
}> = ({ phrases, characterList }) => {
  const [story, setStory] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const { settings } = useSettings();
  const [instructions, setInstructions] = useLocalStorageState<string>(
    "storyCustomInstructions",
    "",
  );
  const [includeCharacterRestrictions, setIncludeCharacterRestrictions] =
    useLocalStorageState<boolean>("storyIncludeCharacterRestrictions", true);
  const [creativity, setCreativity] = useLocalStorageState<number>(
    "storyCreativity",
    1.5,
  );

  const [error, setError] = useState<string | null>(null);

  const genAImodel = useGenerativeModel(settings);

  const promptMain: string = `\
Create an engaging Chinese story for a student learning Mandarin Chinese and living in Taiwan.

Write a complete narrative with interesting characters and plot. Let your creativity flow - write as short or as long as feels natural for the story.

Your story should use the normal way that chinese is used in Taiwan, not mainland China.

Only use traditional characters, and never simplified characters.

${
  includeCharacterRestrictions && characterList.length > 0
    ? "IMPORTANT: Student has a limited vocabulary, so only use these Chinese characters: " +
      characterList.join("") +
      "\n\nDo not use any other Chinese characters! You may use basic English letters, numbers, and punctuation marks.\n\n"
    : ""
}${
    phrases.length > 0
      ? "To inspire your creativity, here are some phrases or words you could incorporate:\n" +
        pickRandomElements(phrases, 60)
          .map((phrase) => phrase.traditional)
          .join(", ")
      : ""
  }

Feel free to use these phrases or create your own content. Write a story that flows naturally and tells a complete tale.

Just write the story in Traditional Chinese. No special formatting needed - just pure storytelling.

${instructions ? `SPECIAL INSTRUCTIONS: ${instructions}` : ""}
`;

  const handleGenerateStory = async () => {
    if (!genAImodel) {
      setError("Please enter a valid API key first.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    setStory(null);

    const request = {
      contents: [{ role: "user", parts: [{ text: promptMain }] }],
      generationConfig: {
        temperature: creativity,
      },
    };

    try {
      const result = await genAImodel.generateContent(request);
      const responseText = result.response.text();

      if (responseText && responseText.trim()) {
        setStory(responseText.trim());
      } else {
        setError("AI did not return a story.");
      }
    } catch (e) {
      console.error(e);
      setError(
        "Failed to generate story. Please check your API key and network connection.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const resetStory = () => setStory(null);

  if (story) {
    if (!genAImodel) {
      return <>Issue with Generative AI model</>;
    }

    return (
      <StoryReader
        story={story}
        characterList={characterList}
        onBack={resetStory}
      />
    );
  }

  return (
    <div className="container mx-auto max-w-2xl text-center p-3">
      {isGenerating ? (
        <>
          <div className="animate-spin mx-auto rounded-full h-16 w-16 m-4 border-b-2 border-gray-900 mb-4"></div>
          Generating story...
        </>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Chinese Story Reader
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Generate a Chinese story and practice listening comprehension
            </p>
          </div>

          <div>
            <label
              htmlFor="instructions"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              (optional) Story theme or instructions:
            </label>
            <Textarea
              id="instructions"
              minRows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3 mb-3 py-2 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md text-md shadow-sm placeholder-slate-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100
                             focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              placeholder="For example: A mystery story about a missing cat in Taipei, or a romance story at a night market..."
              disabled={isGenerating}
            />
          </div>

          {characterList.length > 0 && (
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeCharacterRestrictions}
                  onChange={(e) =>
                    setIncludeCharacterRestrictions(e.target.checked)
                  }
                  disabled={isGenerating}
                  className="mr-2 h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Restrict to learned characters only ({characterList.length}{" "}
                  characters)
                </span>
              </label>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Creativity: {creativity.toFixed(1)}
              <span className="text-xs text-gray-500 ml-2">
                (
                {creativity < 0.5
                  ? "Conservative"
                  : creativity > 1.5
                    ? "Very Creative"
                    : "Balanced"}
                )
              </span>
            </label>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-gray-500">Conservative</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={creativity}
                onChange={(e) => setCreativity(parseFloat(e.target.value))}
                disabled={isGenerating}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className="text-xs text-gray-500">Creative</span>
            </div>
          </div>

          <button
            onClick={handleGenerateStory}
            disabled={isGenerating}
            className="w-full justify-center items-center px-6 py-3 bg-sky-600 text-white font-semibold rounded-md shadow-sm hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            Generate Chinese Story
          </button>
        </>
      )}
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

      <div className="mt-20">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Prompt preview:
        </span>
        <pre className="text-sm text-gray-400 dark:text-gray-300 whitespace-pre-wrap break-all font-mono bg-gray-100 dark:bg-gray-800 text-left p-3 rounded">
          {promptMain}
        </pre>
      </div>
    </div>
  );
};

export default Story;

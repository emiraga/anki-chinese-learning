import { useState } from "react";
import Textarea from "react-textarea-autosize";
import { createGenerativeModel } from "~/apis/google_genai";
import {
  DEFAULT_POS_BREAKDOWN_MODEL,
  POS_BREAKDOWN_MODELS,
  breakdownPos,
} from "~/apis/pos_breakdown";
import { POS_SENTENCES, type PosSentence } from "~/data/pos_sentences";
import { useSettings } from "~/settings/SettingsContext";
import { AnnotatedSentence } from "./PosExamples";

/**
 * Free-form text box whose contents Gemini splits into words labeled with
 * their part of speech, shown like the hand-annotated examples.
 */
export const PosBreakdown: React.FC = () => {
  const { settings } = useSettings();
  const [text, setText] = useState("");
  const [modelName, setModelName] = useState<string>(
    DEFAULT_POS_BREAKDOWN_MODEL,
  );
  const [sentences, setSentences] = useState<PosSentence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = settings.googleCloudApiKey;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSentences([]);
    try {
      const model = createGenerativeModel(apiKey, modelName);
      setSentences(await breakdownPos(model, text, POS_SENTENCES));
    } catch (e) {
      // Shown to the user, and rethrown so it still reaches the console
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-8">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          minRows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Chinese text to break down, e.g. 我昨天在書店買了三本書。"
          className="w-full px-3 py-2 text-lg bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          disabled={loading}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading || !apiKey || !text.trim()}
            className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-md shadow-sm hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {loading ? "Breaking down…" : "Break down"}
          </button>
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Model:{" "}
            <select
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              disabled={loading}
              className="px-2 py-1 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md"
            >
              {POS_BREAKDOWN_MODELS.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
          {!apiKey && (
            <span className="text-sm text-red-700 dark:text-red-400">
              Set the Google API key in Settings first.
            </span>
          )}
        </div>
      </form>
      {error && (
        <div className="mt-2 p-3 whitespace-pre-wrap bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {sentences.length > 0 && (
        <div className="mt-4 space-y-6">
          {sentences.map((sentence, i) => (
            <AnnotatedSentence key={i} sentence={sentence} />
          ))}
        </div>
      )}
    </div>
  );
};

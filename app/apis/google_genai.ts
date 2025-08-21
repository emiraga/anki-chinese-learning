import { DEFAULT_GEN_AI_MODEL, type AppSettings } from "~/settings/schema";
import { 
  GoogleGenerativeAI, 
  type GenerativeModel,
  type GenerationConfig
} from "@google/generative-ai";
import { useMemo } from "react";

export function useGenerativeModel(settings: AppSettings) {
  // Memoize the AI model instance to avoid re-creation on every render
  const model = useMemo(() => {
    if (!settings.googleCloudApiKey) return null;
    const genAI = new GoogleGenerativeAI(settings.googleCloudApiKey);
    const model = genAI.getGenerativeModel({
      model: settings.generativeAi?.llmModelName ?? DEFAULT_GEN_AI_MODEL,
    });
    return model;
  }, [settings]);

  return model;
}

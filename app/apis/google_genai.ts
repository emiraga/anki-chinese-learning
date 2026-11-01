import { DEFAULT_GEN_AI_MODEL, type AppSettings } from "~/settings/schema";
import {
  GoogleGenerativeAI,
  type GenerativeModel,
} from "@google/generative-ai";
import { useMemo } from "react";

export function createGenerativeModel(
  apiKey: string,
  modelName: string,
): GenerativeModel {
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: modelName,
  });
}

export function useGenerativeModel(settings: AppSettings) {
  // Memoize the AI model instance to avoid re-creation on every render
  const model = useMemo(() => {
    if (!settings.googleCloudApiKey) return null;
    return createGenerativeModel(
      settings.googleCloudApiKey,
      settings.generativeAi?.llmModelName ?? DEFAULT_GEN_AI_MODEL,
    );
  }, [settings]);

  return model;
}

import type { JSONSchema7 } from "json-schema";
import Ajv from "ajv";

type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends (infer U)[]
    ? DeepRequired<U>[]
    : T[P] extends object | undefined
      ? DeepRequired<NonNullable<T[P]>>
      : T[P];
};

export interface AppSettings {
  googleCloudApiKey: string;
  phraseNotes: {
    noteType: string;
    cards?: { name?: string; deckName?: string; validateCardsDeck?: boolean }[];
  }[];
  characterNote?: {
    noteType?: string;
  };
  toolbar?: {
    showPropsLink?: boolean;
    showStatsLink?: boolean;
  };
  generativeAi?: {
    llmModelName?: string;
  };
  features?: {
    showZhuyin?: boolean;
  };
}

export const defaultSettings: AppSettings = {
  googleCloudApiKey: "",
  phraseNotes: [
    {
      noteType: "TOCFL",
    },
  ],
};

// Used for testing the schema, all fields must be filled in.
const dummySettings: DeepRequired<AppSettings> = {
  googleCloudApiKey: "test",
  phraseNotes: [
    {
      noteType: "test",
      cards: [{ name: "test", deckName: "test", validateCardsDeck: true }],
    },
  ],
  characterNote: { noteType: "test" },
  toolbar: { showPropsLink: true, showStatsLink: true },
  generativeAi: { llmModelName: "test" },
  features: { showZhuyin: true },
};

export const DEFAULT_GEN_AI_MODEL = "gemini-2.5-flash";

export const settingsJsonSchema: JSONSchema7 = {
  title: "Application Settings",
  description: "Configure the application to your preferences.",
  type: "object",
  properties: {
    googleCloudApiKey: {
      type: "string",
      title: "Google Cloud API key",
      description:
        "You can generate and manage keys via https://console.cloud.google.com/apis/credentials",
    },
    phraseNotes: {
      type: "array",
      title: "Anki Phrases/Words/Sentences Configuration",
      items: {
        type: "object",
        title: "Note type",
        description:
          "For the source of the phrases/words/sentences from anki, we load them from a note",
        properties: {
          noteType: {
            type: "string",
            title: "'Note type' in Anki",
          },
          cards: {
            type: "array",
            title: "(optional) Configuration for cards",
            items: {
              type: "object",
              title: "Card",
              description:
                "Information about cards used for this note (all fields are optional)",
              properties: {
                name: {
                  type: "string",
                  title: "Name of this card",
                },
                deckName: {
                  type: "string",
                  title: "Name of the deck where this card normally belongs",
                },
                validateCardsDeck: {
                  type: "boolean",
                  title:
                    "Validate that this card is placed in the desired deck",
                },
              },
              additionalProperties: false,
              required: [],
            },
          },
        },
        required: ["noteType"],
      },
    },
    characterNote: {
      type: "object",
      title: "(optional) Anki Character Notes Configuration",
      properties: {
        noteType: {
          type: "string",
          title: "Name of the 'Note type' in Anki, sometimes called Model Name",
          description:
            "If you leave this empty, we will infer character data from phrase notes.",
        },
      },
    },
    toolbar: {
      type: "object",
      title: "UI toolbar settings",
      properties: {
        showPropsLink: {
          type: "boolean",
          title: "Show 'Props' link in the toolbar.",
        },
        showStatsLink: {
          type: "boolean",
          title: "Show 'Stats' link in the toolbar.",
        },
      },
    },
    features: {
      type: "object",
      title: "Software features",
      properties: {
        showZhuyin: {
          type: "boolean",
          title: "Show zhuyin in places where it's possible",
        },
      },
    },
    generativeAi: {
      type: "object",
      title: "Generative AI (LLM) settings",
      properties: {
        llmModelName: {
          type: "string",
          title: "LLM model name",
          description:
            "Take a look at https://ai.google.dev/gemini-api/docs/models and https://ai.google.dev/gemini-api/docs/pricing",
          default: DEFAULT_GEN_AI_MODEL,
        },
      },
    },
  },
};

export const settingsUiSchema = {
  googleCloudApiKey: {
    "ui:enableMarkdownInDescription": true,
    "ui:widget": "password",
  },
  phraseNotes: {
    "ui:options": {
      orderable: false,
    },
    items: {
      noteType: {},
      cards: {
        items: {},
      },
    },
  },
  generativeAi: {
    llmModelName: {
      "ui:enableMarkdownInDescription": true,
    },
  },
};

const ajv = new Ajv({ strict: true, allErrors: true });

export function validateSettingsStructure(settings: AppSettings): void {
  const validate = ajv.compile(settingsJsonSchema);
  const isValid = validate(settings);

  if (!isValid) {
    const errors =
      validate.errors
        ?.map((error) => `${error.instancePath || "root"}: ${error.message}`)
        .join("; ") || "Unknown validation error";

    throw new Error(`Settings validation failed: ${errors}`);
  }
}

function validateArraysHaveElements(obj: unknown, path: string = "root"): void {
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      throw new Error(
        `Array at ${path} must have at least one element for validation`,
      );
    }
    obj.forEach((item, index) =>
      validateArraysHaveElements(item, `${path}[${index}]`),
    );
  } else if (obj && typeof obj === "object") {
    Object.entries(obj).forEach(([key, value]) =>
      validateArraysHaveElements(value, `${path}.${key}`),
    );
  }
}

function validateSchemaInterfaceConsistency(): void {
  try {
    validateSettingsStructure(defaultSettings);

    // Recursively validate that all arrays in dummySettings have elements
    validateArraysHaveElements(dummySettings);

    validateSettingsStructure(dummySettings);
  } catch (error) {
    throw new Error(
      `Schema does not match TypeScript interface: ${(error as Error).message}`,
    );
  }
}

// Run validation on module load to catch structural mismatches
try {
  validateSchemaInterfaceConsistency();
} catch (error) {
  console.error("Schema-Interface mismatch detected on module load:", error);
  throw error;
}

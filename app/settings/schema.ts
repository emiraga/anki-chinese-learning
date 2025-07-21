import type { JSONSchema7 } from "json-schema";

export interface AppSettings {
  googleCloudApiKey: string;
  phraseNotes: {
    noteType: string;
    cards?: { name?: string; deck?: string; validateCardsDeck?: boolean };
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
}

export const defaultSettings: AppSettings = {
  googleCloudApiKey: "",
  phraseNotes: [
    {
      noteType: "TOCFL",
    },
  ],
};

export const DEFAULT_GEN_AI_MODEL = "gemini-1.5-flash";

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
            title:
              "Name of the 'Note type' in Anki, sometimes called Model Name",
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

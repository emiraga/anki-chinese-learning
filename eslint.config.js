// eslint.config.js
import typescriptParser from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
// import tailwindcssPlugin from "eslint-plugin-tailwindcss";

export default [
  {
    ignores: [".react-router/**/"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
      react: reactPlugin,
      "react-hooks": hooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
      // tailwindcss: tailwindcssPlugin,
    },
    rules: {
      // General ESLint and TypeScript rules
      ...typescriptPlugin.configs["eslint-recommended"].rules,
      ...typescriptPlugin.configs.recommended.rules,

      // React rules
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules, // If you are using the new JSX transform

      // React Hooks rules
      ...hooksPlugin.configs.recommended.rules,

      // JSX Accessibility rules
      ...jsxA11yPlugin.configs.recommended.rules,

      // Tailwind CSS rules
      // ...tailwindcssPlugin.configs.recommended.rules,

      // You can override or add your own rules here
      "react/prop-types": "off", // Not needed with TypeScript
      "@typescript-eslint/no-empty-object-type": "off",
      "jsx-a11y/media-has-caption": "off",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: ["camelCase"],
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "memberLike",
          modifiers: ["private"],
          format: ["camelCase"],
          leadingUnderscore: "require",
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "enumMember",
          format: ["UPPER_CASE"],
        },
        {
          selector: "objectLiteralProperty",
          format: null, // allow
          filter: {
            regex:
              "^(pinyin_1|pinyin_2|pinyin_anki_1|__html|ui:[a-zA-Z]+|Meaning 2|Content-Type|Pinyin|[0-9]|-(ao|an|ang|e|er|a|o|_|ong|ai|.e.[nui]|.o.u|.e.ng)|([a-z][ui]?|nv|lv|[scz]h?u?|_)-)$",
            match: true,
          },
        },
        {
          selector: "property",
          format: null, // allow
          filter: {
            regex: "^(pinyin_1|pinyin_2|pinyin_anki_1)$",
            match: true,
          },
        },
      ],
    },
    settings: {
      react: {
        version: "detect", // Automatically detects the React version
      },
    },
  },
  {
    files: [".react-router/**/*.ts"],
    rules: {
      "@typescript-eslint/no-namespace": "off",
    },
  },
];

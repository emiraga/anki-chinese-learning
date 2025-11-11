import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import babel from "vite-plugin-babel";
import tsconfigPaths from "vite-tsconfig-paths";

const external = [
  "open",
  "default-browser-id",
  "default-browser",
  "is-wsl",
  "is-inside-container",
  "is-docker",
  "run-applescript",
];

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    babel({
      filter: /\.tsx?$/,
      babelConfig: {
        presets: ["@babel/preset-typescript"],
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tsconfigPaths(),
  ],
  build: {
    rollupOptions: {
      external,
    },
  },
  optimizeDeps: {
    exclude: external,
    // IMPORTANT: Dependencies must be explicitly listed here due to babel-plugin-react-compiler.
    // Vite's automatic dependency discovery (optimizeDeps.entries) fails because esbuild cannot
    // parse JSX in files transformed by the React Compiler. When you see "new dependencies optimized"
    // messages during navigation, add those dependencies to this list, clear cache (rm -rf node_modules/.vite .react-router),
    // and restart the dev server. See CLAUDE.md for more details.
    include: [
      "recharts",
      "@rjsf/core",
      "@rjsf/mui",
      "@rjsf/utils",
      "@rjsf/validator-ajv8",
      "react/compiler-runtime",
      "pinyin-split",
      "pinyin-tools",
      "pinyin",
      "yanki-connect",
      "ajv",
      "@base-ui-components/react/tooltip",
      "@base-ui-components/react/collapsible",
      "zhuyin-improved",
      "react-textarea-autosize",
      "@google/generative-ai",
      "react-async-hook",
      "@emotion/react",
      "@emotion/styled",
      "@mui/icons-material",
      "@mui/material",
      "use-debounce",
      "isbot",
      "react",
      "react-dom",
      "react-is",
      "react-router",
    ],
  },
  server: {
    fs: {
      // Allow serving files from outside the project root for dev tools
      allow: [".."],
    },
  },
});

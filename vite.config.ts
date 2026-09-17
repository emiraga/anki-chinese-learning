import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import babel from "vite-plugin-babel";
import tsconfigPaths from "vite-tsconfig-paths";
import { serveMedia } from "./vite_serve_media";

// Directory of video/audio clips served to the Anki card templates (see
// anki/local-media/front-template.html). Override with the MEDIA_DIR env var,
// either inline (`MEDIA_DIR=~/clips yarn dev`) or in a .env file. A directory
// that does not exist is not an error: those requests simply 404.
const DEFAULT_MEDIA_DIR = "~/InProgressTemporary/you are the apple of my eye";

// URL prefix the clips are mounted under on the dev server.
const MEDIA_URL_PREFIX = "/local-media/";

const external = [
  "open",
  "default-browser-id",
  "default-browser",
  "is-wsl",
  "is-inside-container",
  "is-docker",
  "run-applescript",
];

export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    reactRouter(),
    serveMedia({
      urlPrefix: MEDIA_URL_PREFIX,
      // "" as the prefix so plain MEDIA_DIR (not VITE_MEDIA_DIR) is picked up:
      // this is a server-side path that must not be exposed to the client.
      directory:
        loadEnv(mode, process.cwd(), "").MEDIA_DIR || DEFAULT_MEDIA_DIR,
    }),
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
}));

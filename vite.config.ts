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
  },
  server: {
    fs: {
      // Allow serving files from outside the project root for dev tools
      allow: [".."],
    },
  },
});

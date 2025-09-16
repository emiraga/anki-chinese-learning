import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
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
    tsconfigPaths()
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
      allow: ['..'],
    },
  },
});

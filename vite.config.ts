import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// GitHub Pages serves the site under /<repo>/, so the production build needs a
// matching `base`. Dev keeps serving at root.
const REPO = "human-readable-transactions";

export default defineConfig(({ command }) => ({
  base: command === "build" ? `/${REPO}/` : "/",
  plugins: [react()],
  server: { port: 5188, strictPort: true },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error - plain JS plugin, no types needed
import { manifestPlugin } from "./scripts/manifest-plugin.mjs";

// `base` must match where the extension is hosted.
// GitHub Pages serves project sites from /<repo-name>/.
//
// Git Bash on Windows expands a leading-slash value into an absolute Windows
// path, so reduce whatever we are given to its final segment.
function normaliseBase(raw: string | undefined): string {
  if (!raw || raw === "/") return "/";
  const name = raw.replace(/\\/g, "/").replace(/\/+$/, "").split("/").pop();
  return name ? `/${name}/` : "/";
}

const base = normaliseBase(process.env.VITE_BASE);

export default defineConfig({
  base,
  plugins: [react(), manifestPlugin()],
  build: {
    rollupOptions: {
      input: {
        // One HTML entry per OBR surface.
        action: "index.html",
        sheet: "sheet.html",
        toasts: "toasts.html",
      },
    },
  },
  server: {
    // OBR embeds the extension in an iframe; allow it during local dev.
    cors: true,
  },
});

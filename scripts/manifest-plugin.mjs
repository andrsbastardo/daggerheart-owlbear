import { buildManifest } from "./manifest.mjs";

/**
 * Serves /manifest.json from the dev server and writes it on build.
 *
 * The manifest has to reflect the base URL it is hosted under, so it is
 * generated rather than kept in `public/`. Serving it in dev too means
 * `npm run dev` is enough to add the extension to a room.
 */
export function manifestPlugin() {
  let base = "/";

  return {
    name: "daggerheart-manifest",

    configResolved(config) {
      base = config.base;
    },

    configureServer(server) {
      server.middlewares.use("/manifest.json", (_request, response) => {
        response.setHeader("Content-Type", "application/json");
        // Owlbear fetches the manifest cross-origin from its own page.
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.end(`${JSON.stringify(buildManifest(base), null, 2)}\n`);
      });
    },

    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: `${JSON.stringify(buildManifest(base), null, 2)}\n`,
      });
    },
  };
}

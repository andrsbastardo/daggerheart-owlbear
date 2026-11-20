/**
 * The extension manifest, built against the base URL it is hosted under.
 *
 * Owlbear resolves `icon` and `popover` relative to the manifest's origin, so
 * these must carry the deploy base (root locally, /<repo>/ on GitHub Pages).
 */
export function buildManifest(base = "/") {
  const prefix = base === "/" ? "" : base.replace(/\/$/, "");
  const withBase = (path) => `${prefix}/${path}`;

  return {
    name: "Daggerheart",
    version: "0.1.0",
    manifest_version: 1,
    author: "Andres",
    description:
      "Hojas de personaje, adversarios y entornos para Daggerheart, con permisos de DJ y jugador.",
    icon: withBase("icon.svg"),
    action: {
      title: "Daggerheart",
      icon: withBase("icon.svg"),
      popover: withBase("index.html"),
      height: 600,
      width: 420,
    },
  };
}

import React from "react";

/** Enveloppe Lucide. La charte fixe la famille, la grille et le trait ;
 *  ce composant les applique. Lucide est chargé depuis le CDN par la page hôte
 *  (voir readme.md § ICONOGRAPHIE). */
export function Icon({ name, size = 20, strokeWidth, color = "currentColor", style, ...rest }) {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (window.lucide) return;
    const t = setInterval(() => { if (window.lucide) { setTick((n) => n + 1); clearInterval(t); } }, 60);
    return () => clearInterval(t);
  }, []);

  // Trait : 2 sous 16 px et pour les chevrons, 1,8 sinon.
  const sw = strokeWidth != null ? strokeWidth : size < 16 || /chevron|arrow/i.test(name) ? 2 : 1.8;

  // "chevron-right" → "ChevronRight", "share-2" → "Share2"
  const pascal = String(name)
    .replace(/-(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
  const lib = window.lucide && (window.lucide.icons || window.lucide);
  const node = lib && (lib[pascal] || lib[name]);
  const children = Array.isArray(node) ? (Array.isArray(node[0]) ? node : node[2]) : node && node.children;

  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round",
    "aria-hidden": "true",
    style: { display: "block", flex: "none", ...style }, ...rest
  };

  if (!children) return React.createElement("svg", common);
  return React.createElement(
    "svg", common,
    children.map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))
  );
}

export type ColorRole =
  | "bg" | "surface" | "panel" | "text" | "muted" | "faint" | "line" | "line2"
  | "edge" | "violet" | "violetDeep" | "onViolet" | "apricot" | "onApricot"
  | "band" | "onBand" | "card";

export type Theme = Record<ColorRole, string>;

export const themes: { light: Theme; dark: Theme } = {
  light: {
    bg: "#FFFFFF", surface: "#FAF9FC", panel: "#EDEAF7", card: "#FFFFFF",
    text: "#221F2B", muted: "#4A4556", faint: "#726E82",
    line: "#EDEBF2", line2: "#E2DDF0", edge: "#88839A",
    violet: "#7B6BB7", violetDeep: "#5A4B93", onViolet: "#FFFFFF",
    apricot: "#F0CFB4", onApricot: "#7A4A22",
    band: "#221F2B", onBand: "#FFFFFF",
  },
  dark: {
    bg: "#17161F", surface: "#1E1C29", panel: "#2E2945", card: "#1B1928",
    text: "#F2F0F7", muted: "#B9B4C6", faint: "#9A94A8",
    line: "#2A2836", line2: "#3D3757", edge: "#726C96",
    violet: "#9C8BD8", violetDeep: "#C3B4EE", onViolet: "#15131D",
    apricot: "#F0CFB4", onApricot: "#3A2413",
    band: "#41357E", onBand: "#F2F0F7",
  },
};

const KEBAB: Record<string, string> = {};
function kebab(role: string): string {
  return (KEBAB[role] ??= role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
}

export function cssVariables(theme: Theme): string {
  return Object.entries(theme).map(([role, value]) => `--${kebab(role)}: ${value};`).join(" ");
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)];
  const [hi, lo] = a! > b! ? [a!, b!] : [b!, a!];
  return (hi + 0.05) / (lo + 0.05);
}

import type { Theme } from "./primitives.js";
import { resolve, type SemanticRole } from "./semantic.js";

// Ce que le back-office change, et rien d'autre. Une valeur identique à celle
// du produit n'a pas sa place ici : un test le refuse.
export const adminOverride = {
  tokens: {
    // Un seul caractère : la hiérarchie se fait au poids et à la taille.
    fontDisplay: "Karla, system-ui, -apple-system, \"Segoe UI\", sans-serif",
    fontDisplaySettings: "normal",
    fontDisplayRegular: "600",
    fontDisplayMedium: "700",
    textDisplayXl: "30px", textDisplayL: "26px", textDisplayM: "21px",
    textDisplayS: "18px", textDisplayXs: "15px",
    textBodyL: "15px", textBodyM: "14px", textBodyS: "13px", textBodyXs: "12px",
    textMentionS: "11px",
    leadingDisplay: "1.2", leadingBody: "1.5",
    trackingDisplay: "-0.015em", trackingTitle: "-0.01em",
    controlHeight: "32px", controlPadX: "13px", rowHeight: "44px",
    sidebarWidth: "232px", topbarHeight: "52px",
    radiusXs: "5px", radiusSm: "6px", radiusMd: "6px",
    radiusLg: "8px", radiusXl: "10px", radius2xl: "12px",
  },
  colors: {
    light: {
      surfaceChrome: "#F7F6FA", surfacePage: "#FFFFFF", surfacePanel: "#F2F0F7",
      surfaceCard: "#FFFFFF", surfaceBand: "#221F2B",
      borderHairline: "#E8E5EF", borderObject: "#DCD8E6",
    },
    dark: {
      surfaceChrome: "#131219", surfacePage: "#17161F", surfacePanel: "#1E1C29",
      surfaceCard: "#1B1928", surfaceBand: "#2E2945",
      borderHairline: "#262433", borderObject: "#34314A",
    },
  },
} as const;

export function resolveAdmin(theme: Theme): Record<SemanticRole, string> {
  return { ...resolve(theme), ...adminOverride.colors[theme] };
}

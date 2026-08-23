import { resolve, SEMANTIC_ROLES } from "./semantic.js";
import type { Theme } from "./primitives.js";
import { typography } from "./typography.js";
import { spacing } from "./spacing.js";
import { shape } from "./shape.js";
import { motion } from "./motion.js";
import { density } from "./density.js";
import { adminOverride } from "./admin.js";

function kebab(name: string): string {
  return name.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase();
}

function declare(entries: Record<string, string>): string {
  return Object.entries(entries).map(([k, v]) => `--${kebab(k)}: ${v};`).join("\n  ");
}

export function cssVariables(theme: Theme): string {
  const colors = resolve(theme);
  return declare(Object.fromEntries(SEMANTIC_ROLES.map((r) => [r, colors[r]])));
}

// Ce qui ne dépend pas du thème : émis une seule fois, hors de la bascule.
export function cssTokens(): string {
  return declare({ ...typography, ...spacing, ...shape, ...motion, ...density });
}

// Le bloc de surcharge du back-office. En clair, il porte ses couleurs propres
// et les jetons hors thème (l'outil n'a pas de bascule à part) ; en sombre, il
// ne porte que les couleurs — les jetons hors thème sont déjà posés en clair.
export function cssAdmin(theme: Theme): string {
  if (theme === "light") {
    const declarations = declare({ ...adminOverride.colors.light, ...adminOverride.tokens });
    return `.lehno-admin {\n  ${declarations}\n}`;
  }
  const declarations = declare({ ...adminOverride.colors.dark });
  return `.lehno-admin.lehno-nuit {\n  ${declarations}\n}`;
}

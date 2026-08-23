# Lehno — Socle de design : jetons, adhérence, composants, landing

> **Pour les agents :** COMPÉTENCE REQUISE — utiliser `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes portent des cases à cocher (`- [ ]`).

**But :** faire du système de design le socle réel du produit — un paquet de jetons complet, des règles de lint qui empêchent de le contourner, une bibliothèque de composants, et une landing reconstruite dessus.

**Trois surfaces, un seul socle.** Le produit, le back-office et l'application mobile partagent les mêmes **rôles**. Le back-office n'est pas un système parallèle mais une **surcharge** : il garde les rôles de couleur, le violet qui agit, le rouge qui détruit, les courbes et la règle de focus — et redéfinit ce qui doit l'être. Fraunces y disparaît (elle appartient au produit ; un journal d'audit n'a pas à être intime), l'échelle typographique descend (un tableau de quarante lignes ne se lit pas en 16 px), les rayons se resserrent, les cibles raccourcissent (à la souris, 44 px n'a plus de sens), et une surface apparaît que le produit n'a pas : les barres de l'outil.

**Architecture :** les jetons vivent dans `@lehno/tokens` en **deux couches** — des primitives (la palette brute) et des alias sémantiques qui pointent dessus. Le paquet est la source unique : il émet les variables CSS pour le web, et exposera les mêmes valeurs en objets JavaScript pour React Native en phase 1. Les composants du web consomment les alias, jamais les primitives, et jamais une valeur littérale — ce que le lint fait respecter.

**Pile :** TypeScript · Vitest · Next.js (App Router, rendu serveur) · ESLint (configuration à plat) · pnpm · Turborepo.

**Spec :** `specs/design-system-lehno.md` et le paquet de passation `Public surfaces for Lehno.zip`, extrait en `/tmp/lehno-handoff/design_handoff_surfaces_publiques/`. Ce paquet fait autorité sur toute maquette antérieure — v2, v3, ou rendus empaquetés.

## Contraintes globales

- **Deux couches de jetons.** Un composant lit un **alias sémantique** (`--action`, `--text-body`), jamais une primitive (`--lehno-violet`), jamais un littéral. Le jour où le violet change, la première formulation ne demande aucune relecture.
- **Aucun hexadécimal, aucune durée, aucun rayon en dur** dans un composant. Le lint le refuse.
- **Aucune ombre**, à une exception près : `--shadow-device`, le cadre de téléphone des aperçus.
- **Le thème sombre s'obtient par la classe `lehno-nuit` sur `<body>`** — pas plus bas. La couleur s'hérite en valeur calculée : un thème posé sur un conteneur intermédiaire ne recolore pas le texte hérité au-dessus.
- **Le thème se résout avant la première peinture**, sinon la page s'affiche en clair puis bascule.
- **Les polices s'auto-hébergent** par `next/font/google`. Le `fonts.css` du paquet importe Google Fonts par URL : il sert à ouvrir les prototypes, pas à la production — la politique de sécurité de contenu interdit les sources externes.
- **Fraunces à l'instance de marque** : `"SOFT" 40, "WONK" 1`, graisses 400 et 500. **Karla** pour le texte, 300 à 700.
- **Trois règles de couleur qui ne se négocient pas** : le violet ne teinte jamais le texte courant ; l'abricot n'apparaît qu'aux moments heureux et ne côtoie jamais le rouge ; sur fond sombre, le texte d'un bouton plein passe à l'encre `#15131D`, du blanc sur violet clair ne mesurant que 2,96:1.
- **Le rouge ne sert qu'à trois choses** : erreur de saisie, action destructrice, état hors service.
- **Tout couple texte/fond atteint 4,5:1.** Mesuré par test, pas supposé.
- **Bilingue fr/en**, le français de référence ; l'anglais s'écrit, il ne se traduit pas.
- **`prefers-reduced-motion` remet les durées à zéro.** Un composant qui code sa durée en dur échappe à cette règle : c'est pourquoi elles sont tokenisées.
- Modules ESM, imports relatifs en `.js`. Commentaires en français, code et identifiants en anglais.
- **TDD** : le test s'écrit avant le code, on le voit échouer, puis on le fait passer. Commit à chaque tâche.

## Une correction au paquet, déjà tranchée

`--on-celebrate` vaut `#8A5527` dans `tokens/colors.css`. Mesuré sur l'abricot `#F0CFB4`, cela donne **4,19:1** — sous le seuil. C'est la valeur de la maquette v2, corrigée depuis en `#7A4A22` (5,05:1) par le propriétaire, et le paquet est revenu à l'ancienne.

**Ce plan retient `#7A4A22`.** Les vingt-huit autres paires du paquet ont été mesurées et passent toutes.

## Structure des fichiers

```
packages/tokens/src/
  primitives.ts     la palette brute, par thème — aucun rôle
  semantic.ts       les alias : quel rôle pointe sur quelle primitive
  typography.ts     familles, graisses, tailles, interlignages, approches
  spacing.ts        échelle d'espacement, gouttières, mesures de ligne
  shape.ts          rayons, filets, anneau de focus, l'unique ombre
  motion.ts         courbes, durées, transitions composées
  density.ts        hauteurs de contrôle et de ligne, largeurs de coquille
  admin.ts          la surcharge du back-office : ce qu'il change, et rien d'autre
  css.ts            émission des variables CSS pour le web
  contrast.ts       mesure du contraste (déjà présent, à conserver)
  index.ts

packages/eslint-config/
  adherence.js      les règles qui empêchent de contourner les jetons

apps/web/
  app/globals.css   importe les variables émises, plus les classes de base
  components/ui/    la bibliothèque : un fichier par composant
  components/landing/  les sections de la landing
```

---

### Tâche 1 : Les couleurs, en deux couches

**Fichiers :**
- Créer : `packages/tokens/src/primitives.ts`, `packages/tokens/src/semantic.ts`
- Modifier : `packages/tokens/src/index.ts`
- Remplacer : `packages/tokens/src/themes.ts` (les 17 rôles actuels disparaissent)
- Test : `packages/tokens/src/couleurs.test.ts`

**Interfaces :**
- Produit : `primitives.light` / `primitives.dark` (`Record<PrimitiveName, string>`) ; `semantic.light` / `semantic.dark` (`Record<SemanticRole, string>`) où chaque valeur est **le nom d'une primitive**, pas une couleur ; `resolve(theme)` qui rend `Record<SemanticRole, string>` en couleurs réelles ; les types `PrimitiveName` et `SemanticRole`.
- Consommé par : les tâches 2 à 9, et l'application mobile en phase 1.

**Pourquoi deux couches.** Un composant qui dit « violet » oblige à relire chaque usage le jour où le violet change. Un composant qui dit « ce qui agit » ne demande rien. La première couche nomme des couleurs, la seconde nomme des intentions — et seule la seconde est visible depuis un composant.

- [ ] **Étape 1 : écrire le test qui échoue**

`packages/tokens/src/couleurs.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { primitives, semantic, resolve, contrastRatio, SEMANTIC_ROLES } from "./index.js";

describe("couleurs", () => {
  it("les deux thèmes portent exactement les mêmes rôles", () => {
    expect(Object.keys(semantic.light).sort()).toEqual([...SEMANTIC_ROLES].sort());
    expect(Object.keys(semantic.dark).sort()).toEqual([...SEMANTIC_ROLES].sort());
  });

  // Un alias qui désignerait une primitive absente ne se verrait qu'à l'exécution,
  // et seulement dans le thème concerné.
  it("chaque alias pointe sur une primitive qui existe, dans les deux thèmes", () => {
    for (const theme of ["light", "dark"] as const)
      for (const [role, primitive] of Object.entries(semantic[theme]))
        expect(primitives[theme], `${theme}.${role} → ${primitive}`).toHaveProperty(primitive);
  });

  it("resolve rend des couleurs, pas des noms", () => {
    expect(resolve("light").action).toBe("#7B6BB7");
    expect(resolve("dark").action).toBe("#9C8BD8");
    expect(resolve("light").textBody).toBe("#221F2B");
  });

  // Le contraste est une propriété du produit : on le mesure, on ne l'espère pas.
  it.each([
    ["textBody", "surfacePage"], ["textSecondary", "surfacePage"], ["textMention", "surfacePage"],
    ["textMention", "surfacePanel"], ["textBody", "surfaceCard"], ["textAccent", "surfacePage"],
    ["textOnAccent", "action"], ["onBand", "surfaceBand"], ["onCelebrate", "celebrate"],
    ["feedbackInfo", "feedbackInfoBg"], ["feedbackSuccess", "feedbackSuccessBg"],
    ["feedbackWarning", "feedbackWarningBg"], ["feedbackError", "feedbackErrorBg"],
  ] as const)("%s sur %s atteint 4,5:1 dans les deux thèmes", (fg, bg) => {
    for (const theme of ["light", "dark"] as const) {
      const c = resolve(theme);
      expect(contrastRatio(c[fg], c[bg]), `${theme} : ${fg} sur ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Règle du système : du blanc sur violet clair ne mesure que 2,96:1.
  it("en thème sombre, le texte d'un bouton plein est de l'encre, pas du blanc", () => {
    expect(resolve("dark").textOnAccent).toBe("#15131D");
    expect(contrastRatio("#FFFFFF", resolve("dark").action)).toBeLessThan(4.5);
  });

  it("l'anneau de focus se distingue du fond qu'il entoure", () => {
    for (const theme of ["light", "dark"] as const) {
      const c = resolve(theme);
      expect(contrastRatio(c.focusRing, c.surfacePage)).toBeGreaterThanOrEqual(3);
    }
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/tokens test`
Attendu : ÉCHEC — `primitives` n'est pas exporté.

- [ ] **Étape 3 : les primitives**

`packages/tokens/src/primitives.ts` :
```ts
// La palette brute. Ces noms désignent des couleurs, pas des usages :
// aucun composant ne doit les lire directement — voir semantic.ts.
export const primitives = {
  light: {
    paper: "#FFFFFF",
    ink: "#221F2B",
    violet: "#7B6BB7",
    violetDeep: "#5A4B93",
    violetPress: "#4A3D7C",
    lilac: "#EDEAF7",
    apricot: "#F0CFB4",
    // Le gris de mention vaut le gris de texte : 4,708 sur lilas, 5,581 sur
    // papier. La hiérarchie entre mention et texte secondaire tient par la
    // taille (11,5 contre 14 px), signal plus sûr que trois pas de gris.
    greyText: "#6B6579",
    greyMention: "#6B6579",
    rule: "#EDEBF2",
    ruleStrong: "#E2DDF0",
    edge: "#88839A",
    info: "#5A4B93",
    success: "#166B43",
    warning: "#8A5A00",
    error: "#B3261E",
    infoBg: "#EDEAF7",
    successBg: "#E6F4EC",
    warningBg: "#FBF0DC",
    errorBg: "#FBEAE8",
    // 5,049 sur l'abricot. Le paquet donne #8A5527, qui n'atteint que 4,19 —
    // valeur de la maquette v2, corrigée depuis par le propriétaire.
    onApricot: "#7A4A22",
  },
  dark: {
    paper: "#17161F",
    ink: "#F2F0F7",
    violet: "#9C8BD8",
    violetDeep: "#C3B4EE",
    violetPress: "#8877CC",
    violetHi: "#B0A2E2",
    lilac: "#2E2945",
    apricot: "#F0CFB4",
    greyText: "#B9B4C6",
    greyMention: "#9A94A8",
    rule: "#2A2836",
    ruleStrong: "#3D3757",
    edge: "#726C96",
    card: "#1B1928",
    surface: "#1E1C29",
    band: "#41357E",
    onAccent: "#15131D",
    info: "#C3B4EE",
    success: "#7ED9A6",
    warning: "#E3B25C",
    error: "#F2837A",
    infoBg: "#2E2945",
    successBg: "#163024",
    warningBg: "#322814",
    errorBg: "#35191A",
    onApricot: "#3A2413",
  },
} as const;

export type Theme = keyof typeof primitives;
export type PrimitiveName = keyof typeof primitives.light | keyof typeof primitives.dark;
```

- [ ] **Étape 4 : les alias sémantiques**

`packages/tokens/src/semantic.ts` :
```ts
import { primitives, type PrimitiveName, type Theme } from "./primitives.js";

export const SEMANTIC_ROLES = [
  // surfaceChrome n'existe que pour le back-office — les barres d'un outil.
  // Le produit le fait pointer sur surfacePage : une application n'a pas de barres.
  "surfacePage", "surfacePanel", "surfaceCard", "surfaceBand", "onBand", "surfaceChrome",
  "textBody", "textSecondary", "textMention", "textAccent", "textOnAccent",
  "action", "actionHover", "actionPress", "actionEdge", "actionQuietBg",
  "borderHairline", "borderObject", "focusRing",
  "celebrate", "onCelebrate",
  "feedbackInfo", "feedbackInfoBg", "feedbackSuccess", "feedbackSuccessBg",
  "feedbackWarning", "feedbackWarningBg", "feedbackError", "feedbackErrorBg",
] as const;

export type SemanticRole = (typeof SEMANTIC_ROLES)[number];

// Chaque rôle nomme une intention et pointe sur une primitive. C'est ici, et
// nulle part ailleurs, que se décide « ce qui agit est violet ».
export const semantic: Record<Theme, Record<SemanticRole, PrimitiveName>> = {
  light: {
    surfacePage: "paper", surfacePanel: "lilac", surfaceCard: "paper",
    surfaceBand: "ink", onBand: "paper", surfaceChrome: "paper",
    textBody: "ink", textSecondary: "greyText", textMention: "greyMention",
    textAccent: "violetDeep", textOnAccent: "paper",
    action: "violet", actionHover: "violetDeep", actionPress: "violetPress",
    actionEdge: "violet", actionQuietBg: "lilac",
    borderHairline: "rule", borderObject: "ruleStrong", focusRing: "violet",
    celebrate: "apricot", onCelebrate: "onApricot",
    feedbackInfo: "info", feedbackInfoBg: "infoBg",
    feedbackSuccess: "success", feedbackSuccessBg: "successBg",
    feedbackWarning: "warning", feedbackWarningBg: "warningBg",
    feedbackError: "error", feedbackErrorBg: "errorBg",
  },
  dark: {
    surfacePage: "paper", surfacePanel: "lilac", surfaceCard: "card",
    surfaceBand: "band", onBand: "ink", surfaceChrome: "paper",
    textBody: "ink", textSecondary: "greyText", textMention: "greyMention",
    textAccent: "violetDeep", textOnAccent: "onAccent",
    action: "violet", actionHover: "violetHi", actionPress: "violetPress",
    actionEdge: "edge", actionQuietBg: "lilac",
    borderHairline: "rule", borderObject: "ruleStrong", focusRing: "violet",
    celebrate: "apricot", onCelebrate: "onApricot",
    feedbackInfo: "info", feedbackInfoBg: "infoBg",
    feedbackSuccess: "success", feedbackSuccessBg: "successBg",
    feedbackWarning: "warning", feedbackWarningBg: "warningBg",
    feedbackError: "error", feedbackErrorBg: "errorBg",
  },
};

export function resolve(theme: Theme): Record<SemanticRole, string> {
  const palette = primitives[theme] as Record<string, string>;
  return Object.fromEntries(
    SEMANTIC_ROLES.map((role) => [role, palette[semantic[theme][role]]!]),
  ) as Record<SemanticRole, string>;
}
```

`packages/tokens/src/index.ts` réexporte `primitives`, `semantic`, `resolve`, `SEMANTIC_ROLES`, les types, et conserve `contrastRatio` de `contrast.ts`.

Le fichier `themes.ts` et son test disparaissent : leurs 17 rôles sont remplacés par les 28 ci-dessus. Supprime aussi le test qui épinglait la limite de `faint` sur `panel` — cette limite n'existe plus, le gris de mention ayant changé.

- [ ] **Étape 5 : le voir passer**

Lancer : `pnpm --filter @lehno/tokens test`
Attendu : SUCCÈS. Si la paire `onCelebrate` sur `celebrate` échoue, c'est que `#8A5527` a été repris du paquet au lieu de `#7A4A22`.

- [ ] **Étape 6 : commit**

```bash
git add packages/tokens
git commit -m "jetons: primitives et alias sémantiques, contraste des 13 paires vérifié"
```

---

### Tâche 2 : Typographie, espacements, formes, mouvement, densité — et leur émission en CSS

**Fichiers :**
- Créer : `packages/tokens/src/typography.ts`, `spacing.ts`, `shape.ts`, `motion.ts`, `density.ts`, `css.ts`
- Modifier : `packages/tokens/src/index.ts`
- Test : `packages/tokens/src/css.test.ts`

**Interfaces :**
- Produit : `typography`, `spacing`, `shape`, `motion` (objets figés) ; `cssVariables(theme): string` qui rend les déclarations d'un thème ; `cssTokens(): string` qui rend celles qui ne dépendent pas du thème.
- Consommé par : les tâches 4 à 9.

**La densité est une famille à part.** Hauteur de contrôle, hauteur de ligne, largeur de barre latérale : le produit et le back-office n'ont pas les mêmes, parce qu'ils ne se manipulent pas de la même façon. Au doigt, une cible descend rarement sous 44 px ; à la souris, 32 px suffisent et laissent voir quarante lignes au lieu de vingt-cinq.

**Ce que le mouvement garantit.** Trois durées par nature — état 120 ms, entrée 220 ms, écran 340 ms — et leur remise à zéro sous `prefers-reduced-motion`. Un composant qui code sa durée en dur échappe à cette remise à zéro : c'est la raison d'être de ces jetons, pas une commodité.

- [ ] **Étape 1 : écrire le test qui échoue**

`packages/tokens/src/css.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { cssVariables, cssTokens, typography, spacing, shape, motion, density } from "./index.js";

describe("émission CSS", () => {
  it("nomme les rôles en tirets, pas en casse chameau", () => {
    const css = cssVariables("light");
    expect(css).toContain("--surface-page: #FFFFFF;");
    expect(css).toContain("--text-on-accent: #FFFFFF;");
    expect(css).not.toMatch(/--[a-z]+[A-Z]/);
  });

  it("le thème sombre rend d'autres valeurs pour les mêmes rôles", () => {
    expect(cssVariables("dark")).toContain("--surface-page: #17161F;");
    expect(cssVariables("dark")).toContain("--text-on-accent: #15131D;");
  });

  it("les jetons hors thème sortent une seule fois", () => {
    const css = cssTokens();
    expect(css).toContain("--radius-sm: 10px;");
    expect(css).toContain("--space-16: 16px;");
    expect(css).toContain("--duration-state: 120ms;");
    expect(css).toContain('--font-display-settings: "SOFT" 40, "WONK" 1;');
  });

  // La seule ombre admise par le système, pour le cadre de téléphone des aperçus.
  it("une seule ombre existe, et elle est nommée", () => {
    expect(Object.keys(shape).filter((k) => k.startsWith("shadow"))).toEqual(["shadowDevice"]);
  });

  it("les échelles ont les valeurs du système", () => {
    expect(typography.textDisplayXl).toBe("76px");
    expect(typography.textMentionS).toBe("11.5px");
    expect(spacing.pageMax).toBe("1160px");
    expect(spacing.touchMin).toBe("44px");
    expect(shape.radiusPill).toBe("999px");
    expect(motion.durationScreen).toBe("340ms");
    expect(density.controlHeight).toBe("40px");
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/tokens test css`
Attendu : ÉCHEC — `cssVariables` n'accepte pas de thème, `cssTokens` n'existe pas.

- [ ] **Étape 3 : implémenter les quatre familles**

`packages/tokens/src/typography.ts` :
```ts
export const typography = {
  fontDisplay: 'Fraunces, Georgia, "Times New Roman", serif',
  fontBody: 'Karla, system-ui, -apple-system, "Segoe UI", sans-serif',
  // L'instance de marque de Fraunces. Sans elle, la police rend sa forme neutre.
  fontDisplaySettings: '"SOFT" 40, "WONK" 1',
  fontDisplayRegular: "400", fontDisplayMedium: "500",
  fontBodyLight: "300", fontBodyRegular: "400", fontBodyMedium: "500",
  fontBodySemibold: "600", fontBodyBold: "700",
  textDisplayXl: "76px", textDisplayL: "50px", textDisplayM: "38px",
  textDisplayS: "30px", textDisplayXs: "22px",
  textBodyL: "18px", textBodyM: "16px", textBodyS: "15px", textBodyXs: "13.5px",
  textMentionS: "11.5px", textKicker: "11px",
  leadingDisplay: "1.05", leadingTitle: "1.15", leadingBody: "1.55", leadingRoomy: "1.6",
  trackingTitle: "-0.02em", trackingDisplay: "-0.03em", trackingKicker: "0.14em",
} as const;
```

`packages/tokens/src/spacing.ts` :
```ts
export const spacing = {
  space2: "2px", space4: "4px", space6: "6px", space8: "8px", space10: "10px",
  space12: "12px", space14: "14px", space16: "16px", space20: "20px",
  space24: "24px", space28: "28px", space32: "32px", space40: "40px",
  space44: "44px", space56: "56px", space72: "72px", space92: "92px",
  pageMax: "1160px", pageGutter: "20px",
  sectionPadY: "clamp(52px, 7vw, 92px)",
  measure: "62ch", measureTight: "42ch",
  // Cible tactile minimale : en deçà, on rate le bouton au pouce.
  touchMin: "44px",
} as const;
```

`packages/tokens/src/shape.ts` :
```ts
export const shape = {
  radiusXs: "8px", radiusSm: "10px", radiusMd: "12px", radiusLg: "13px",
  radiusXl: "18px", radius2xl: "22px", radiusPill: "999px", radiusTile: "22%",
  borderWidth: "1px", borderWidthFirm: "2px",
  focusWidth: "2px", focusOffset: "2px",
  // La seule ombre du produit : le cadre de téléphone des aperçus. Partout
  // ailleurs la profondeur vient des filets d'un pixel.
  shadowDevice: "0 18px 40px rgba(34, 31, 43, 0.10)",
} as const;
```

`packages/tokens/src/density.ts` :
```ts
// Le produit se manipule au doigt, l'outil à la souris. Ces valeurs sont la
// seule chose qui les distingue vraiment à l'usage.
export const density = {
  controlHeight: "40px",
  controlPadX: "16px",
  rowHeight: "56px",
  sidebarWidth: "0px",   // le produit n'a pas de barre latérale
  topbarHeight: "0px",
} as const;
```

`packages/tokens/src/motion.ts` :
```ts
export const motion = {
  easePose: "cubic-bezier(0.22, 0.8, 0.24, 1)",
  easeTraverse: "cubic-bezier(0.36, 0, 0.16, 1)",
  easeState: "ease-out",
  durationState: "120ms",   // survol, focus, changement d'état d'un bouton
  durationEnter: "220ms",   // carte, accordéon, bascule de thème
  durationScreen: "340ms",  // changement d'écran, panneau qui entre
} as const;
```

`packages/tokens/src/css.ts` :
```ts
import { resolve, SEMANTIC_ROLES } from "./semantic.js";
import type { Theme } from "./primitives.js";
import { typography } from "./typography.js";
import { spacing } from "./spacing.js";
import { shape } from "./shape.js";
import { motion } from "./motion.js";
import { density } from "./density.js";

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
```

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/tokens test`
Attendu : SUCCÈS, les deux fichiers de test.

- [ ] **Étape 5 : commit**

```bash
git add packages/tokens
git commit -m "jetons: typographie, espacements, formes, mouvement, et leur émission CSS"
```

---

### Tâche 3 : La surcharge du back-office

**Fichiers :**
- Créer : `packages/tokens/src/admin.ts`
- Modifier : `packages/tokens/src/css.ts`, `packages/tokens/src/index.ts`
- Test : `packages/tokens/src/admin.test.ts`

**Interfaces :**
- Produit : `adminOverride` — ce que le back-office change, et **rien d'autre** ; `cssAdmin(theme)` qui émet le bloc de surcharge.
- Consommé par : la tâche 5 (feuille globale du web), et le back-office quand il arrivera.

**Un système parent, pas un clone.** Le back-office garde du produit ses rôles de couleur, son violet qui agit, son rouge qui détruit, ses courbes et sa règle de focus. Il change quatre choses, et chacune a sa raison :

- **Fraunces disparaît.** Elle appartient au produit ; un journal d'audit n'a pas à être intime. La hiérarchie s'y fait au poids et à la taille.
- **L'échelle typographique descend.** Un tableau de quarante lignes ne se lit pas en 16 px.
- **Les rayons se resserrent et les cibles raccourcissent.** À la souris, 44 px de cible n'a plus de sens — et 32 px laissent voir quarante lignes là où 56 en montrent vingt-cinq.
- **Une surface apparaît**, `surfaceChrome` : les barres de l'outil. Une application n'en a pas ; un outil, si.

**La règle qui gouverne cette tâche** : `adminOverride` ne contient **que des écarts**. Si une valeur y figure alors qu'elle est identique à celle du produit, elle sera un jour modifiée d'un côté seulement — et les deux diverger sans que personne ne l'ait décidé. Un test le vérifie.

- [ ] **Étape 1 : écrire le test qui échoue**

`packages/tokens/src/admin.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import {
  adminOverride, resolveAdmin, cssAdmin, contrastRatio,
  typography, shape, density,
} from "./index.js";

describe("surcharge du back-office", () => {
  // Une valeur identique des deux côtés finira par être modifiée d'un seul,
  // et les deux divergeront sans que personne ne l'ait voulu.
  it("ne contient que des écarts, jamais une valeur déjà identique au produit", () => {
    const produit: Record<string, string> = { ...typography, ...shape, ...density };
    for (const [clef, valeur] of Object.entries(adminOverride.tokens))
      expect(produit[clef], `${clef} est identique au produit : à retirer`).not.toBe(valeur);
  });

  it("efface Fraunces : un outil n'a pas à être intime", () => {
    expect(adminOverride.tokens.fontDisplay).toBe(typography.fontBody);
    expect(adminOverride.tokens.fontDisplaySettings).toBe("normal");
  });

  it("descend l'échelle : un tableau de quarante lignes ne se lit pas en 16 px", () => {
    expect(adminOverride.tokens.textBodyM).toBe("14px");
    expect(adminOverride.tokens.textDisplayXl).toBe("30px");
  });

  it("raccourcit les cibles, la souris n'ayant pas besoin du pouce", () => {
    expect(adminOverride.tokens.controlHeight).toBe("32px");
    expect(adminOverride.tokens.rowHeight).toBe("44px");
    expect(density.controlHeight).toBe("40px");
  });

  it("ouvre une surface que le produit n'a pas", () => {
    expect(resolveAdmin("light").surfaceChrome).toBe("#F7F6FA");
    expect(resolveAdmin("dark").surfaceChrome).toBe("#131219");
  });

  // Le back-office hérite des couleurs de texte du produit : ses surfaces
  // propres doivent donc les porter aussi.
  it.each([
    ["textBody", "surfaceChrome"], ["textSecondary", "surfaceChrome"],
    ["textBody", "surfacePanel"], ["textSecondary", "surfacePanel"],
    ["textAccent", "surfaceChrome"], ["textBody", "surfaceCard"],
  ] as const)("%s sur %s atteint 4,5:1 dans les deux thèmes", (fg, bg) => {
    for (const theme of ["light", "dark"] as const) {
      const c = resolveAdmin(theme);
      expect(contrastRatio(c[fg], c[bg]), `${theme} : ${fg} sur ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("le bloc CSS se pose sur la classe de l'outil, et se combine au thème", () => {
    expect(cssAdmin("light")).toContain(".lehno-admin {");
    expect(cssAdmin("dark")).toContain(".lehno-admin.lehno-nuit {");
    expect(cssAdmin("light")).toContain("--surface-chrome: #F7F6FA;");
    expect(cssAdmin("light")).toContain("--control-height: 32px;");
  });

  it("le bloc sombre ne réémet pas ce qui ne dépend pas du thème", () => {
    expect(cssAdmin("dark")).not.toContain("--control-height:");
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/tokens test admin`
Attendu : ÉCHEC — `admin.js` n'existe pas.

- [ ] **Étape 3 : implémenter**

`packages/tokens/src/admin.ts` :
```ts
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
```

`cssAdmin(theme)` dans `css.ts` émet, pour le thème clair, la surcharge de couleurs **et** les jetons hors thème sous `.lehno-admin` ; pour le sombre, les seules couleurs sous `.lehno-admin.lehno-nuit`. Réémettre les jetons hors thème dans le bloc sombre les dupliquerait sans raison.

**Ce que cette tâche ne fait pas.** Le paquet porte aussi les règles de repli de la coquille sous 900 px — barre latérale qui glisse, menu qui apparaît. Ce sont des règles de mise en page, pas des jetons : elles iront avec le back-office, en phase 4. La densité, elle, part maintenant parce qu'elle est partagée.

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/tokens test`
Attendu : SUCCÈS, les trois fichiers de test.

- [ ] **Étape 5 : commit**

```bash
git add packages/tokens
git commit -m "jetons: la surcharge du back-office, en écarts seulement"
```

---
### Tâche 4 : Les règles d'adhérence, en lint

**Fichiers :**
- Créer : `packages/eslint-config/adherence.js`
- Modifier : `packages/eslint-config/index.js`, `eslint.config.js` (racine)
- Test : `packages/eslint-config/adherence.test.js`

**Interfaces :**
- Produit : une configuration à plat exportée sous le nom `adherence`, appliquée aux fichiers de `apps/web/components/**` et `apps/web/app/**`.

**Ce que ces règles remplacent.** Trois contraintes du système sont aujourd'hui des phrases dans un document. Une phrase se contourne par distraction ; une règle de lint, non. Ce sont exactement celles dont la violation ne se voit pas à l'œil : une couleur en dur marche parfaitement — jusqu'à la bascule de thème ; une durée en dur s'anime bien — sauf pour qui a demandé moins de mouvement.

- [ ] **Étape 1 : écrire le test qui échoue**

`packages/eslint-config/adherence.test.js` :
```js
import { describe, expect, it } from "vitest";
import { Linter } from "eslint";
import { adherence } from "./adherence.js";

const linter = new Linter({ configType: "flat" });
const check = (code) =>
  linter.verify(code, [...adherence, { files: ["**/*.tsx"] }], "composant.tsx");

describe("adhérence au système de design", () => {
  it("refuse une couleur écrite en dur", () => {
    const messages = check(`export const C = () => <div style={{ color: "#7B6BB7" }} />;`);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toMatch(/jeton/i);
  });

  it("accepte un jeton sémantique", () => {
    expect(check(`export const C = () => <div style={{ color: "var(--text-body)" }} />;`)).toEqual([]);
  });

  // Une primitive marche, mais elle nomme une couleur au lieu d'une intention :
  // c'est ce qui oblige à relire chaque usage le jour où la couleur change.
  it("refuse une primitive employée directement", () => {
    const messages = check(`export const C = () => <div style={{ color: "var(--lehno-violet)" }} />;`);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toMatch(/primitive/i);
  });

  it("refuse une ombre, sauf celle du cadre d'appareil", () => {
    expect(check(`export const C = () => <div style={{ boxShadow: "0 2px 4px #0003" }} />;`)).toHaveLength(1);
    expect(check(`export const C = () => <div style={{ boxShadow: "var(--shadow-device)" }} />;`)).toEqual([]);
  });

  it("refuse une durée écrite en dur", () => {
    const messages = check(`export const C = () => <div style={{ transition: "color 150ms" }} />;`);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toMatch(/durée|mouvement/i);
  });

  it("laisse passer ce qui n'est pas du style", () => {
    expect(check(`export const C = () => <div data-id="#7B6BB7" />;`)).toEqual([]);
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/eslint-config test`
Attendu : ÉCHEC — `adherence.js` n'existe pas.

- [ ] **Étape 3 : implémenter**

`packages/eslint-config/adherence.js` — une règle locale, écrite avec l'API de règle d'ESLint. Elle inspecte les propriétés d'objet dont la clé est une propriété de style connue (`color`, `background`, `backgroundColor`, `borderColor`, `boxShadow`, `transition`, `animation`, `borderRadius`) et dont la valeur est une chaîne littérale :

```js
const PROPRIETES_DE_STYLE = new Set([
  "color", "background", "backgroundColor", "borderColor", "border",
  "boxShadow", "transition", "animation", "animationDuration",
  "transitionDuration", "borderRadius", "fill", "stroke",
]);

const HEXADECIMAL = /#[0-9a-fA-F]{3,8}\b/;
const PRIMITIVE = /var\(--lehno-/;
const DUREE = /\b\d+m?s\b/;
const OMBRE_ADMISE = "var(--shadow-device)";

const regle = {
  meta: { type: "problem", docs: { description: "n'employer que les jetons du système de design" } },
  create(context) {
    const signaler = (node, message) => context.report({ node, message });
    return {
      Property(node) {
        const cle = node.key.name ?? node.key.value;
        if (!PROPRIETES_DE_STYLE.has(cle)) return;
        if (node.value.type !== "Literal" || typeof node.value.value !== "string") return;
        const valeur = node.value.value;

        if (HEXADECIMAL.test(valeur))
          signaler(node, `Couleur écrite en dur : employez un jeton sémantique, par exemple var(--text-body).`);
        else if (PRIMITIVE.test(valeur))
          signaler(node, `Primitive employée directement : elle nomme une couleur, pas une intention. Passez par un alias sémantique.`);
        else if (cle === "boxShadow" && valeur !== OMBRE_ADMISE && valeur !== "none")
          signaler(node, `Aucune ombre dans ce produit : la profondeur vient des filets. Seul var(--shadow-device) est admis.`);
        else if (DUREE.test(valeur) && !valeur.includes("var(--duration"))
          signaler(node, `Durée écrite en dur : elle échappe à prefers-reduced-motion. Employez var(--duration-state), --duration-enter ou --duration-screen.`);
      },
    };
  },
};

export const adherence = [
  {
    plugins: { lehno: { rules: { "jetons-seulement": regle } } },
    rules: { "lehno/jetons-seulement": "error" },
  },
];
```

`packages/eslint-config/index.js` réexporte `adherence`. Le fichier `eslint.config.js` de la racine l'applique aux seuls fichiers de `apps/web/components/**` et `apps/web/app/**` — pas aux tests, ni aux paquets, ni au serveur.

- [ ] **Étape 4 : le voir passer, puis mordre pour de vrai**

```bash
pnpm --filter @lehno/eslint-config test
```
Attendu : SUCCÈS, 6 tests.

Puis la preuve qui compte — introduis une couleur en dur dans un vrai composant, lance `pnpm lint` depuis la racine, montre qu'il **échoue** en la signalant, retire-la, relance, montre qu'il passe. Un test unitaire de règle ne prouve pas qu'elle est branchée.

- [ ] **Étape 5 : commit**

```bash
git add packages/eslint-config eslint.config.js
git commit -m "adhérence: le lint refuse couleurs, ombres et durées écrites en dur"
```

---

### Tâche 5 : La feuille globale du web

**Fichiers :**
- Remplacer : `apps/web/app/globals.css`
- Créer : `apps/web/lib/theme-css.ts`, `apps/web/app/base.css`
- Modifier : `apps/web/app/layout.tsx`, `apps/web/lib/theme-script.ts`
- Test : `apps/web/test/theme.test.ts`

**Interfaces :**
- Consomme : `cssVariables`, `cssTokens` de `@lehno/tokens`.
- Produit : `themeCss` (chaîne injectée dans `<head>`), et les classes de base `.titre`, `.citation`, `.surtitre`.

**Le changement de mécanisme.** Le thème passe d'un attribut sur `<html>` à la **classe `lehno-nuit` sur `<body>`**, comme le système l'impose. Sa raison : la couleur s'hérite en valeur calculée, donc un thème posé sur un conteneur intermédiaire ne recolore pas le texte hérité au-dessus. Le script de résolution avant peinture doit suivre — mais `<body>` n'existe pas encore quand un script de `<head>` s'exécute. Le script pose donc la classe sur `<html>` en attendant, et une règle CSS fait porter les deux : `:root.lehno-nuit, body.lehno-nuit { … }`.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/web/test/theme.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { themeScript } from "../lib/theme-script.js";
import { themeCss } from "../lib/theme-css.js";

describe("thème", () => {
  const executer = (stocke: string | null, prefereSombre: boolean): string => {
    const racine = { classList: { add: (c: string) => { racine.classes.push(c); }, remove: () => {} }, classes: [] as string[] };
    const fn = new Function("localStorage", "matchMedia", "document", themeScript);
    fn(
      { getItem: () => stocke },
      (q: string) => ({ matches: prefereSombre && q.includes("dark") }),
      { documentElement: racine },
    );
    return racine.classes.join(" ");
  };

  it("le choix explicite l'emporte sur le système", () => {
    expect(executer("light", true)).toBe("");
    expect(executer("dark", false)).toBe("lehno-nuit");
  });

  it("sans choix, il suit le système", () => {
    expect(executer(null, true)).toBe("lehno-nuit");
    expect(executer(null, false)).toBe("");
  });

  it("un stockage inaccessible ne fait pas planter la page", () => {
    const racine = { classList: { add: () => {}, remove: () => {} } };
    const fn = new Function("localStorage", "matchMedia", "document", themeScript);
    expect(() => fn(
      { getItem: () => { throw new Error("bloqué"); } },
      () => ({ matches: false }),
      { documentElement: racine },
    )).not.toThrow();
  });

  // La règle doit viser la racine ET le corps : le script ne peut poser la
  // classe que sur la racine, le corps n'existant pas encore.
  it("la feuille fait porter le thème sombre par la racine comme par le corps", () => {
    expect(themeCss).toContain(":root.lehno-nuit, body.lehno-nuit");
  });

  // Le back-office redéfinit le rayon : deux occurrences attendues, une par
  // contexte, jamais deux dans le même.
  it("les jetons hors thème ne sont émis qu'une fois par contexte", () => {
    expect(themeCss.match(/--radius-sm:/g)).toHaveLength(2);
    expect(themeCss).toContain(".lehno-admin {");
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/web test theme`
Attendu : ÉCHEC — le script pose un attribut, pas une classe ; `theme-css.js` n'existe pas.

- [ ] **Étape 3 : implémenter**

`apps/web/lib/theme-script.ts` :
```ts
// Injecté en ligne dans <head>, il s'exécute avant la première peinture.
// <body> n'existe pas encore à ce moment : la classe se pose sur la racine,
// et la feuille fait porter le thème par les deux.
export const themeScript = `
try {
  var choix = localStorage.getItem("lehno.theme");
  var sombre = choix === "dark" ||
    ((!choix || choix === "system") && matchMedia("(prefers-color-scheme: dark)").matches);
  if (sombre) document.documentElement.classList.add("lehno-nuit");
} catch (e) {}
`.trim();
```

`apps/web/lib/theme-css.ts` :
```ts
import { cssVariables, cssTokens, cssAdmin } from "@lehno/tokens";

// La surcharge du back-office est émise ici aussi : elle ne coûte que sa taille
// tant qu'aucune page ne porte la classe, et évite une seconde feuille à tenir.
export const themeCss = `
:root {
  ${cssTokens()}
  ${cssVariables("light")}
}
:root.lehno-nuit, body.lehno-nuit {
  ${cssVariables("dark")}
}
${cssAdmin("light")}
${cssAdmin("dark")}
`.trim();
```

`apps/web/app/base.css` porte les classes de base et **aucune couleur littérale** : `.titre` (police de titre, instance de marque, approche resserrée), `.citation` (italique), `.surtitre` (capitales, approche large), la réduction de mouvement, et la règle de focus visible employant `--focus-ring`, `--focus-width`, `--focus-offset`.

`apps/web/app/globals.css` importe `base.css` et pose le corps de page sur `--surface-page` et `--text-body`.

`apps/web/app/layout.tsx` injecte `themeCss` dans une balise `<style>` de `<head>`, puis `themeScript`, et applique les variables de police au `<html>`.

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/web test`
Attendu : SUCCÈS.

- [ ] **Étape 5 : vérifier à l'œil**

```bash
pnpm --filter @lehno/web dev
```
Ouvrir la page, basculer le thème du système, recharger : aucun éclair de thème clair avant le sombre. Réduire le mouvement dans les réglages du système et vérifier que les transitions cessent.

- [ ] **Étape 6 : commit**

```bash
git add apps/web
git commit -m "web: feuille globale émise depuis les jetons, thème par classe sur le corps"
```

---

### Tâche 6 : Les six composants du noyau

**Fichiers :**
- Créer : `apps/web/components/ui/{Button,Card,Tag,SectionLabel,Avatar,Icon}.tsx`
- Créer : `apps/web/components/ui/index.ts`
- Test : `apps/web/test/ui-noyau.test.tsx`

**Interfaces :**
- Produit : les six composants, aux contrats exacts du paquet de passation. Leurs `.d.ts` de référence sont dans `/tmp/lehno-handoff/design_handoff_surfaces_publiques/components/core/` — **lis-les, ils font foi**, ainsi que les `.prompt.md` à côté, qui nomment les pièges de chacun.
- Consommé par : les tâches 7 à 9.

**Comment travailler.** Les `.jsx` du paquet sont des **références de design, pas du code à copier** : ils portent les valeurs exactes et les intentions en commentaires. Lis-les, puis réécris en TypeScript, avec les jetons — jamais les valeurs littérales qu'ils contiennent.

**La règle qui compte le plus ici.** `Button` a six rangs, et **un seul « primary » par vue**. En thème sombre, le texte d'un bouton plein est de l'encre `#15131D` — mais tu n'écris pas cette valeur : tu écris `var(--text-on-accent)`, qui la porte déjà. C'est exactement pourquoi les alias existent.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/web/test/ui-noyau.test.tsx` :
```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button, Card, Tag, SectionLabel, Avatar, Icon } from "../components/ui/index.js";

describe("noyau", () => {
  it("le bouton rend un vrai bouton, accessible par son libellé", () => {
    render(<Button>Commencer</Button>);
    expect(screen.getByRole("button", { name: "Commencer" })).toBeInTheDocument();
  });

  it("le bouton désactivé l'est pour les technologies d'assistance", () => {
    render(<Button disabled>Commencer</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  // Aucune valeur littérale : c'est ce qui rend la bascule de thème fiable.
  it.each(["primary", "outline", "text", "destructive", "destructive-outline", "neutral"] as const)(
    "le rang %s n'emploie que des jetons",
    (variant) => {
      const { container } = render(<Button variant={variant}>x</Button>);
      const style = container.querySelector("button")!.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style).not.toMatch(/var\(--lehno-/);
    },
  );

  it("la cible tactile du bouton mobile atteint le minimum de la charte", () => {
    const { container } = render(<Button platform="mobile">x</Button>);
    expect(container.querySelector("button")!.getAttribute("style")).toContain("var(--touch-min)");
  });

  it("l'avatar sans photo montre l'initiale et reste nommé", () => {
    render(<Avatar name="Valentine" />);
    expect(screen.getByText("V")).toBeInTheDocument();
    expect(screen.getByLabelText("Valentine")).toBeInTheDocument();
  });

  it("l'avatar avec photo porte un texte de remplacement", () => {
    render(<Avatar name="Valentine" src="/v.jpg" />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Valentine");
  });

  // Une icône accompagne un texte : elle ne doit pas être annoncée deux fois.
  it("l'icône décorative est masquée aux technologies d'assistance", () => {
    const { container } = render(<Icon name="calendar" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("l'icône prend la couleur du texte qu'elle accompagne", () => {
    const { container } = render(<Icon name="calendar" />);
    expect(container.querySelector("svg")).toHaveAttribute("stroke", "currentColor");
  });

  it.each(["card", "panel", "plain"] as const)("la carte %s n'emploie que des jetons", (surface) => {
    const { container } = render(<Card surface={surface}>x</Card>);
    const style = container.firstElementChild!.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("aucun composant du noyau ne porte d'ombre", () => {
    for (const element of [<Button key="b">x</Button>, <Card key="c">x</Card>, <Tag key="t">x</Tag>]) {
      const { container } = render(element);
      expect(container.innerHTML).not.toMatch(/box-shadow/i);
    }
  });

  it("le surtitre et l'étiquette rendent leur contenu", () => {
    render(<><SectionLabel>Ce qui approche</SectionLabel><Tag tone="celebrate">aujourd'hui</Tag></>);
    expect(screen.getByText("Ce qui approche")).toBeInTheDocument();
    expect(screen.getByText("aujourd'hui")).toBeInTheDocument();
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/web test ui-noyau`
Attendu : ÉCHEC — `components/ui/index.js` introuvable.

- [ ] **Étape 3 : implémenter**

Ajoute `lucide-react` aux dépendances de `apps/web` — `Icon` en tire ses tracés. Le verrou doit suivre : vérifie avec `pnpm install --frozen-lockfile`.

`Button` porte ses six rangs par une table de styles, chacun n'employant que des jetons. La forme du rang `primary` :

```tsx
const RANGS: Record<NonNullable<ButtonProps["variant"]>, React.CSSProperties> = {
  primary: {
    background: "var(--action)",
    color: "var(--text-on-accent)",
    border: "var(--border-width) solid transparent",
  },
  outline: {
    background: "transparent",
    color: "var(--text-accent)",
    border: "var(--border-width) solid var(--action-edge)",
  },
  text: { background: "transparent", color: "var(--text-accent)", border: "none" },
  destructive: {
    background: "var(--feedback-error)",
    color: "var(--surface-page)",
    border: "var(--border-width) solid transparent",
  },
  "destructive-outline": {
    background: "transparent",
    color: "var(--feedback-error)",
    border: "var(--border-width) solid var(--feedback-error)",
  },
  neutral: {
    background: "var(--action-quiet-bg)",
    color: "var(--text-accent)",
    border: "var(--border-width) solid transparent",
  },
};
```

La plateforme décide la hauteur, la taille de texte et le rayon : web 40 px, 15 px, `--radius-sm` ; mobile `--touch-min` au minimum, 16 px, `--radius-md`. La transition emploie `var(--transition-state)`.

Les cinq autres suivent leur contrat et les valeurs de leur prototype. Deux points à ne pas manquer : `Avatar` sans photo compose l'initiale dans la police de titre sur `--surface-panel`, et porte quand même un nom accessible ; `Icon` rend l'attribut `aria-hidden` par défaut, une icône accompagnant un texte ne devant pas être annoncée deux fois.

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/web test` puis `pnpm lint`
Attendu : SUCCÈS, et le lint muet — s'il parle, une valeur littérale a survécu.

- [ ] **Étape 5 : commit**

```bash
git add apps/web packages
git commit -m "interface: les six composants du noyau, sur les jetons sémantiques"
```

---

### Tâche 7 : Contenu, message et saisie

**Fichiers :**
- Créer : `apps/web/components/ui/{Countdown,Provenance,Quote,Banner,TextField}.tsx`
- Modifier : `apps/web/components/ui/index.ts`
- Test : `apps/web/test/ui-contenu.test.tsx`

**Interfaces :**
- Produit : les cinq composants. Contrats et pièges dans `components/{content,feedback,forms}/` du paquet.

**Deux règles de produit portées par ces composants.**

Le **décompte** est la signature visuelle de Lehno : composé dans la police de titre, il devient un objet plutôt qu'une donnée. Sa notation diffère par langue — `J−3` en français, `3 days` en anglais — parce que « jour J » n'a pas d'équivalent anglais. À zéro jour, il bascule sur la pastille « aujourd'hui », en abricot.

Le **bandeau** porte quatre intentions. Celle d'information prend le violet de la marque : c'est le produit qui s'adresse à vous. Le rouge ne sert qu'à trois choses — erreur de saisie, action destructrice, état hors service — et **ne côtoie jamais l'abricot**.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/web/test/ui-contenu.test.tsx` :
```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Countdown, Provenance, Quote, Banner, TextField } from "../components/ui/index.js";

describe("contenu, message, saisie", () => {
  it("le décompte suit la notation de sa langue", () => {
    const { rerender } = render(<Countdown days={3} locale="fr" />);
    expect(screen.getByText(/J.3/)).toBeInTheDocument();
    rerender(<Countdown days={3} locale="en" />);
    expect(screen.getByText("3 days")).toBeInTheDocument();
  });

  it("à zéro jour, le décompte devient « aujourd'hui »", () => {
    render(<Countdown days={0} locale="fr" />);
    expect(screen.getByText(/aujourd'hui/i)).toBeInTheDocument();
  });

  it("le singulier anglais n'est pas au pluriel", () => {
    render(<Countdown days={1} locale="en" />);
    expect(screen.getByText("1 day")).toBeInTheDocument();
  });

  it.each(["info", "success", "warning", "error"] as const)(
    "le bandeau %s n'emploie que des jetons et annonce son rôle",
    (intent) => {
      const { container } = render(<Banner intent={intent}>message</Banner>);
      const style = container.firstElementChild!.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style).toContain(`var(--feedback-${intent})`);
    },
  );

  // Un message d'erreur qui n'est pas annoncé n'existe pas pour qui n'y regarde pas.
  it("le bandeau d'erreur est annoncé aux technologies d'assistance", () => {
    render(<Banner intent="error">adresse invalide</Banner>);
    expect(screen.getByRole("alert")).toHaveTextContent("adresse invalide");
  });

  it("le bandeau ne se ferme que si on lui donne de quoi le faire", async () => {
    const fermer = vi.fn();
    const { rerender } = render(<Banner intent="info">x</Banner>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<Banner intent="info" onDismiss={fermer}>x</Banner>);
    await userEvent.click(screen.getByRole("button"));
    expect(fermer).toHaveBeenCalledOnce();
  });

  it("le champ lie son libellé à sa saisie", async () => {
    render(<TextField label="Votre adresse" />);
    await userEvent.type(screen.getByLabelText("Votre adresse"), "a@b.fr");
    expect(screen.getByLabelText("Votre adresse")).toHaveValue("a@b.fr");
  });

  it("un champ invalide le dit, et son aide devient le message d'erreur", () => {
    render(<TextField label="Adresse" hint="Cette adresse ne convient pas" invalid />);
    const champ = screen.getByLabelText("Adresse");
    expect(champ).toHaveAttribute("aria-invalid", "true");
    expect(champ).toHaveAccessibleDescription("Cette adresse ne convient pas");
  });

  // Sous 16 px, le navigateur mobile agrandit la page à la mise au point.
  it("le champ mobile ne descend pas sous 16 px", () => {
    const { container } = render(<TextField platform="mobile" label="x" />);
    expect(container.querySelector("input")!.getAttribute("style")).toContain("var(--text-body-m)");
  });

  it("la citation met les guillemets au-delà du seuil, pas avant", () => {
    const court = "Merci pour l'été dernier.";
    const long = "Karim, 36 ans et toujours cette manie de refaire le monde à minuit, merci pour tout.";
    const { rerender } = render(<Quote>{court}</Quote>);
    expect(screen.getByText(court)).not.toHaveTextContent("«");
    rerender(<Quote>{long}</Quote>);
    expect(screen.getByText(/«/)).toBeInTheDocument();
  });

  it("la provenance rend son origine et sa date", () => {
    render(<Provenance origin="noté" date="en mars" />);
    expect(screen.getByText(/noté.*en mars/)).toBeInTheDocument();
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/web test ui-contenu`
Attendu : ÉCHEC — les composants n'existent pas.

- [ ] **Étape 3 : implémenter**

Lis les prototypes et les `.prompt.md` du paquet, puis réécris. Trois points à traiter avec soin :

`Countdown` compose son texte selon la langue, et bascule à zéro jour sur une pastille employant `--celebrate` et `--on-celebrate`. Sa taille suit les trois paliers du contrat — 20 px en ligne de liste, 34 px en carte, 76 px en vue d'échéance — et emploie `--font-display` avec `--font-display-settings`.

`Banner` porte l'intention par une paire de jetons, `--feedback-<intention>` pour le texte et `--feedback-<intention>-bg` pour le fond. Angles droits, sans bordure ni ombre. L'intention d'erreur porte `role="alert"` ; les trois autres, `role="status"`.

`TextField` relie son libellé par `htmlFor`, et son aide par `aria-describedby`. Quand il est invalide, l'aide passe en `--feedback-error` et le champ porte `aria-invalid`. En mode mobile, la taille de texte ne descend pas sous `--text-body-m`.

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/web test` puis `pnpm lint`
Attendu : SUCCÈS, lint muet.

- [ ] **Étape 5 : commit**

```bash
git add apps/web
git commit -m "interface: décompte, provenance, citation, bandeau et champ de saisie"
```

---

### Tâche 8 : La marque, et ses fichiers au bon endroit

**Fichiers :**
- Créer : `apps/web/components/ui/{BrandMark,Wordmark,SocialGlyph}.tsx`
- Créer : `apps/web/public/brand/` (copie des fichiers de marque), `apps/web/public/` (jeu de favicons)
- Modifier : `apps/web/components/ui/index.ts`, `apps/web/app/layout.tsx`
- Test : `apps/web/test/marque.test.tsx`

**Interfaces :**
- Produit : `BrandMark` (six variantes), `Wordmark` (quatre variantes), `SocialGlyph` ; les fichiers de marque servis, et les métadonnées de favicon.

**Le piège de cette tâche est le placement, pas le code.** Le manifeste livré déclare ses icônes à la racine — `/icon-192.png` — alors que les fichiers vivent dans `images/exports/favicon/`. Copier le dossier tel quel donne une icône vide à l'installation, sans qu'aucune erreur ne le signale. **Vérifie chaque chemin déclaré contre le fichier réellement servi.**

Deux règles de la charte s'appliquent ici. Le signe ne descend **jamais sous 28 px**, et sous 40 px c'est la variante `favicon` qui sert — tracé épaissi, empattements retirés : les paliers se redessinent, ils ne se réduisent pas. La variante `blanc` du logotype occupe **la même boîte** que `couleur`, ce qui permet de les permuter sans décaler la mise en page.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/web/test/marque.test.tsx` :
```tsx
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { render, screen } from "@testing-library/react";
import { BrandMark, Wordmark } from "../components/ui/index.js";

describe("marque", () => {
  it("le logotype porte un nom accessible", () => {
    render(<Wordmark variant="couleur" height={32} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/lehno/i);
  });

  it.each(["couleur", "blanc", "inverse", "uneEncre"] as const)(
    "la variante %s du logotype désigne un fichier réellement servi",
    (variant) => {
      const { container } = render(<Wordmark variant={variant} height={32} />);
      const src = container.querySelector("img")!.getAttribute("src")!;
      expect(existsSync(`apps/web/public${src}`), `manquant : public${src}`).toBe(true);
    },
  );

  it.each(["violet", "ronde", "claire", "encre", "uneEncre", "favicon"] as const)(
    "la variante %s de la pastille désigne un fichier réellement servi",
    (variant) => {
      const { container } = render(<BrandMark variant={variant} size={64} />);
      const src = container.querySelector("img")!.getAttribute("src")!;
      expect(existsSync(`apps/web/public${src}`), `manquant : public${src}`).toBe(true);
    },
  );

  // Les paliers se redessinent : réduire le grand donne un tracé trop fin.
  it("sous 40 px, la pastille bascule sur le tracé épaissi", () => {
    const { container } = render(<BrandMark size={28} />);
    expect(container.querySelector("img")!.getAttribute("src")).toContain("favicon");
  });

  it("la pastille refuse de descendre sous la taille minimale", () => {
    expect(() => render(<BrandMark size={20} />)).toThrow(/28/);
  });

  // Un manifeste dont les chemins ne résolvent pas donne une icône vide,
  // sans qu'aucune erreur ne le signale.
  it("chaque icône du manifeste existe là où il la déclare", async () => {
    const manifeste = JSON.parse(await readFile("apps/web/public/site.webmanifest", "utf-8"));
    for (const icone of manifeste.icons)
      expect(existsSync(`apps/web/public${icone.src}`), `manquant : public${icone.src}`).toBe(true);
  });

  it("le manifeste porte les deux usages, ordinaire et masquable", async () => {
    const manifeste = JSON.parse(await readFile("apps/web/public/site.webmanifest", "utf-8"));
    const usages = manifeste.icons.map((i: { purpose: string }) => i.purpose);
    expect(usages).toContain("any");
    expect(usages).toContain("maskable");
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/web test marque`
Attendu : ÉCHEC — les composants et les fichiers n'existent pas.

- [ ] **Étape 3 : placer les fichiers**

Copie depuis `images/` du dépôt :
- `images/brand/svg/*.svg` et `images/exports/lehno-logotype-blanc.svg` → `apps/web/public/brand/`
- le contenu de `images/exports/favicon/` → **la racine de** `apps/web/public/`, pas dans un sous-dossier — c'est ce que le manifeste déclare

Puis **relis le manifeste** et corrige les chemins qui ne résolvent pas. Le test ci-dessus le vérifie, mais lis-le quand même : il ne couvre que les icônes déclarées, pas `apple-touch-icon` ni `safari-pinned-tab`, qui se déclarent dans les métadonnées de la page.

`apps/web/app/layout.tsx` déclare les icônes par l'objet `metadata` de Next.js — favicon, `apple-touch-icon`, `manifest`. La couleur de thème du manifeste vaut `#7B6BB7` : c'est le violet du thème clair. En thème sombre le produit emploie `#9C8BD8`, mais un manifeste ne porte qu'une valeur — le violet clair reste lisible sur une barre système sombre. Laisse tel quel, et note-le en commentaire.

- [ ] **Étape 4 : implémenter les trois composants**

`BrandMark` et `Wordmark` rendent une image, choisissant leur fichier selon la variante. `BrandMark` lève si la taille demandée descend sous 28 px, et bascule seule sur la variante `favicon` sous 40 px. `SocialGlyph` suit son contrat dans le paquet.

- [ ] **Étape 5 : le voir passer**

Lancer : `pnpm --filter @lehno/web test`
Attendu : SUCCÈS. Puis vérifie à l'œil : ouvre la page, regarde l'onglet du navigateur, et installe la page sur un téléphone ou dans l'outil de développement pour voir l'icône réelle.

- [ ] **Étape 6 : commit**

```bash
git add apps/web
git commit -m "marque: pastille, logotype et glyphes sociaux, avec les fichiers au bon chemin"
```

---

### Tâche 9 : La landing, reconstruite sur les prototypes

**Fichiers :**
- Remplacer : `apps/web/components/{Hero,Prix,BadgesMagasins,FormulaireAttente,ApercuApplication,Marque}.tsx` et ce qui reste de l'ancienne version
- Créer : `apps/web/components/landing/{SiteHeader,Hero,HowItWorks,FeatureRow,Pricing,ClosingBand,SiteFooter}.tsx`
- Modifier : `apps/web/app/[locale]/page.tsx`, `apps/web/messages/{fr,en}.ts`
- Test : `apps/web/test/landing.test.tsx`

**Interfaces :**
- Consomme : les quinze composants des tâches 6 à 8, `GET /v1/public/config`.
- Produit : la landing en deux langues et deux thèmes.

**La référence est `ui_kits/web/`** du paquet — `Hero.jsx`, `HowItWorks.jsx`, `FeatureRow.jsx`, `Pricing.jsx`, `ClosingBand.jsx`, `SiteHeader.jsx`, `SiteFooter.jsx`, `PublicShell.jsx`. **Pas** `specs/Landing Lehno v3.dc.html`, que le paquet remplace. Ouvre les prototypes avant d'écrire : `npx serve /tmp/lehno-handoff/design_handoff_surfaces_publiques` puis `ui_kits/web/index.html`, qui porte les bascules de langue, de thème et d'état de lancement.

**Trois choses que l'ancienne version faisait bien — garde-les.** Le repli si l'API ne répond pas : une page de pré-lancement ne peut pas dépendre du serveur pour s'afficher. Les prix jamais en dur : ils viennent de `/v1/public/config`, et le paquet le confirme. La bascule de langue, avec l'anglais **écrit** plutôt que traduit.

**Une chose qu'elle faisait de trop** : une section « Mur » insérée dans la landing, qu'aucun fichier du paquet ne prévoit. Le Mur est une surface à part, hors du périmètre de cette tâche.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/web/test/landing.test.tsx` :
```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Landing from "../app/[locale]/page.js";

const config = { signupFreeCredits: 5, creditUnitPrice: 100, currency: "XAF", referralBonusInvited: 0 };

describe("landing", () => {
  it("rend le titre dans la langue demandée", async () => {
    render(await Landing({ params: { locale: "fr" }, config }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Soyez là le jour J");
  });

  it("l'anglais est écrit, pas décalqué", async () => {
    render(await Landing({ params: { locale: "en" }, config }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Be there on the day");
  });

  it("porte un seul titre de premier rang", async () => {
    render(await Landing({ params: { locale: "fr" }, config }));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  // Un prix figé dans la page devient faux le jour où l'administration le change.
  it("le prix vient de la configuration, jamais du code", async () => {
    render(await Landing({ params: { locale: "fr" }, config: { ...config, creditUnitPrice: 150 } }));
    expect(screen.getByText(/150/)).toBeInTheDocument();
    expect(screen.queryByText(/\b100\b/)).not.toBeInTheDocument();
  });

  it("les crédits offerts viennent aussi de la configuration", async () => {
    render(await Landing({ params: { locale: "fr" }, config: { ...config, signupFreeCredits: 3 } }));
    expect(screen.getByText(/3 crédits/)).toBeInTheDocument();
  });

  it("chaque image porte un texte de remplacement", async () => {
    render(await Landing({ params: { locale: "fr" }, config }));
    for (const img of screen.getAllByRole("img")) expect(img).toHaveAccessibleName();
  });

  // Le système l'impose : un seul bouton plein par vue.
  it("une seule action est mise en avant", async () => {
    const { container } = render(await Landing({ params: { locale: "fr" }, config }));
    const pleins = [...container.querySelectorAll("button, a")].filter((e) =>
      (e.getAttribute("style") ?? "").includes("var(--action)"));
    expect(pleins.length).toBeLessThanOrEqual(1);
  });

  it("aucune section « Mur » — c'est une surface à part", async () => {
    render(await Landing({ params: { locale: "fr" }, config }));
    expect(screen.queryByRole("heading", { name: /votre page à vous/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/web test landing`
Attendu : ÉCHEC — l'ancienne landing porte encore la section « Mur » et deux boutons pleins.

- [ ] **Étape 3 : implémenter**

Reconstruis section par section depuis les prototypes, en n'employant que les composants des tâches 6 à 8 et les jetons. Les textes vivent dans `messages/{fr,en}.ts` ; **aucune chaîne dans un composant**.

La page charge la configuration au rendu serveur, avec le repli que l'ancienne version avait déjà :

```tsx
export const revalidate = 300; // la configuration bouge rarement

async function chargerConfig() {
  const r = await fetch(`${process.env.API_URL}/v1/public/config`, { next: { revalidate } });
  if (!r.ok) return { signupFreeCredits: 5, creditUnitPrice: 100, currency: "XAF", referralBonusInvited: 0 };
  return r.json();
}
```

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/web test` puis `pnpm lint`
Attendu : SUCCÈS, lint muet.

- [ ] **Étape 5 : comparer aux prototypes, à l'œil**

Ouvre les deux côte à côte — le prototype servi et `pnpm --filter @lehno/web dev` — et compare dans les quatre combinaisons : français clair, français sombre, anglais clair, anglais sombre. Puis réduis la fenêtre sous le seuil de repli du menu. Vérifie enfin qu'aucune ombre n'apparaît nulle part.

- [ ] **Étape 6 : commit**

```bash
git add apps/web
git commit -m "landing: reconstruite sur les prototypes du système de design"
```

---

## Ce que ce plan ne couvre pas

Le paquet de passation décrit **toutes** les surfaces publiques. Ce plan ne traite que le socle et la landing. Restent, pour un plan ultérieur : la coquille publique, le Mur, la collecte, le dépôt de vœux, l'invitation au parrainage, les pages légales et la foire aux questions, les pages d'état, et le bandeau de consentement. Le paquet en porte les prototypes complets — c'est du travail cadré, pas de la conception à reprendre.

Le kit d'application (`ui_kits/app/`) attend la phase 1 : ses cinq écrans et sa barre d'onglets consommeront les mêmes jetons, servis en objets JavaScript plutôt qu'en variables CSS.

## Ce qui reste ouvert

- **La notation du décompte en anglais.** Le contrat dit que `3 days` « reste ouverte ». Si une forme plus courte est retenue, elle se change en un endroit.
- **La couleur de thème du manifeste** ne porte qu'une valeur pour deux thèmes.
- **`--on-celebrate`** vaut `#7A4A22` dans ce plan et `#8A5527` dans le paquet. À corriger à la source, sans quoi la prochaine régénération réintroduira une paire sous le seuil.

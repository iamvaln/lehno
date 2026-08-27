import { primitives, type PrimitiveName, type Theme } from "./primitives.js";

export const SEMANTIC_ROLES = [
  // surfaceChrome n'existe que pour le back-office — les barres d'un outil.
  // Le produit le fait pointer sur surfacePage : une application n'a pas de barres.
  "surfacePage", "surfacePanel", "surfaceCard", "surfaceBand", "onBand", "surfaceChrome",
  "textBody", "textSecondary", "textMention", "textAccent", "textOnAccent",
  "action", "actionHover", "actionPress", "actionEdge", "actionQuietBg",
  "borderHairline", "borderObject", "focusRing",
  /* La fête a deux emplois. `celebrate` est la PASTILLE — le point du jour même,
     qui ne porte pas de texte. `celebrateFill` est l'APLAT — un bouton, un
     bandeau — et il est plus soutenu, parce qu'un texte s'y pose. Les confondre
     donnait un libellé illisible sur son propre fond. */
  "celebrate", "onCelebrate", "celebrateFill", "onCelebrateFill",
  // Les illustrations nomment leurs propres rôles plutôt que d'emprunter ceux
  // de l'action. En thème clair la masse tombe sur le même violet ; les
  // confondre ferait repeindre vingt-six illustrations le jour où la couleur
  // d'action bouge. Une masse d'illustration n'est pas une action.
  "illusMass", "illusForm", "illusWarm",
  "feedbackInfo", "feedbackInfoBg", "feedbackSuccess", "feedbackSuccessBg",
  "feedbackWarning", "feedbackWarningBg", "feedbackError", "feedbackErrorBg", "feedbackErrorPress",
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
    celebrateFill: "apricotDeep", onCelebrateFill: "ink",
    illusMass: "violet", illusForm: "lilac", illusWarm: "apricot",
    feedbackInfo: "info", feedbackInfoBg: "infoBg",
    feedbackSuccess: "success", feedbackSuccessBg: "successBg",
    feedbackWarning: "warning", feedbackWarningBg: "warningBg",
    feedbackError: "error", feedbackErrorBg: "errorBg", feedbackErrorPress: "errorPress",
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
    celebrateFill: "apricotDeep", onCelebrateFill: "ink",
    illusMass: "violet", illusForm: "lilac", illusWarm: "apricot",
    feedbackInfo: "info", feedbackInfoBg: "infoBg",
    feedbackSuccess: "success", feedbackSuccessBg: "successBg",
    feedbackWarning: "warning", feedbackWarningBg: "warningBg",
    feedbackError: "error", feedbackErrorBg: "errorBg", feedbackErrorPress: "errorPress",
  },
};

export function resolve(theme: Theme): Record<SemanticRole, string> {
  const palette = primitives[theme] as Record<string, string>;
  return Object.fromEntries(
    SEMANTIC_ROLES.map((role) => [role, palette[semantic[theme][role]]!]),
  ) as Record<SemanticRole, string>;
}

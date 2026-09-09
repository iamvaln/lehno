import * as React from "react";

export type Reseau = "instagram" | "tiktok" | "x" | "linkedin" | "facebook" | "youtube";

export interface SocialGlyphProps {
  reseau: Reseau;
  /** Palier du système : 17 px par défaut. Sous 16 px, X et TikTok deviennent illisibles. */
  size?: number;
  /** Prend la couleur du texte par défaut, comme toute icône du système. */
  color?: string;
  /** Chemin vers la racine du design system, pour atteindre `assets/social/`. */
  base?: string;
}

export declare function SocialGlyph(props: SocialGlyphProps): React.ReactElement | null;

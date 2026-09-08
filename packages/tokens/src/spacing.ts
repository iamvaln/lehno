export const spacing = {
  space2: "2px", space4: "4px", space6: "6px", space8: "8px", space10: "10px",
  space12: "12px", space14: "14px", space16: "16px", space20: "20px",
  space24: "24px", space28: "28px", space32: "32px", space40: "40px",
  space44: "44px", space56: "56px", space72: "72px", space92: "92px",
  pageMax: "1160px", pageGutter: "20px",
  /* La largeur des pages de TEXTE — FAQ, contact, pages légales.
   *
   * Elles partageaient les 1160px de la landing, qui les remplit avec des
   * grilles. Leur colonne de lecture y flottait à gauche, laissant quatre cents
   * pixels de vide à droite — d'autant plus visible que la bande de pied prend
   * toute la largeur, elle.
   *
   * 820 plutôt que `measure` : la colonne de la FAQ fait 760, et il lui faut de
   * quoi respirer sans que le titre quitte le bord gauche. Resserrer le
   * CONTENEUR plutôt que centrer son contenu garde la composition telle qu'elle
   * a été dessinée ; c'est le vide qui disparaît, pas l'ancrage. */
  pageMaxTexte: "820px",
  sectionPadY: "clamp(52px, 7vw, 92px)",
  measure: "62ch", measureTight: "42ch",
  // Cible tactile minimale : en deçà, on rate le bouton au pouce.
  touchMin: "44px",
} as const;

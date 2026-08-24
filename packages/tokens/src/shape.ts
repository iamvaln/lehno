export const shape = {
  radiusXs: "8px", radiusSm: "10px", radiusMd: "12px", radiusLg: "13px",
  radiusXl: "18px", radius2xl: "22px", radiusPill: "999px", radiusTile: "22%",
  borderWidth: "1px", borderWidthFirm: "2px",
  focusWidth: "2px", focusOffset: "2px",
  // Les deux jetons du cadre de téléphone des aperçus. Ils décrivent un objet
  // physique, pas le langage de l'interface : un iPhone a ce rayon-là et cette
  // ombre-là, et rien d'autre dans le produit ne les emploie. Les nommer ici
  // évite qu'ils s'écrivent en dur dans un composant, ce que le lint refuse.
  radiusDevice: "48px",
  // Le noir de la Dynamic Island : une découpe dans la dalle, donc la même
  // valeur dans les deux thèmes. Ce n'est pas une couleur d'interface.
  islandDevice: "#000000",
  shadowDevice: "0 18px 40px rgba(34, 31, 43, 0.10)",
} as const;

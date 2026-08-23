export const shape = {
  radiusXs: "8px", radiusSm: "10px", radiusMd: "12px", radiusLg: "13px",
  radiusXl: "18px", radius2xl: "22px", radiusPill: "999px", radiusTile: "22%",
  borderWidth: "1px", borderWidthFirm: "2px",
  focusWidth: "2px", focusOffset: "2px",
  // La seule ombre du produit : le cadre de téléphone des aperçus. Partout
  // ailleurs la profondeur vient des filets d'un pixel.
  shadowDevice: "0 18px 40px rgba(34, 31, 43, 0.10)",
} as const;

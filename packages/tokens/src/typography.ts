export const typography = {
  fontDisplay: 'Fraunces, Georgia, "Times New Roman", serif',
  fontBody: 'Karla, system-ui, -apple-system, "Segoe UI", sans-serif',
  // L'instance de marque de Fraunces. Sans elle, la police rend sa forme neutre.
  fontDisplaySettings: '"SOFT" 40, "WONK" 1',
  fontDisplayRegular: "400", fontDisplayMedium: "500",
  // Karla 300 a été retirée : déclarée, employée nulle part. Un jeton inutilisé
  // finit par être utilisé — et en natif, il aurait fallu embarquer un fichier.
  fontBodyRegular: "400", fontBodyMedium: "500",
  fontBodySemibold: "600", fontBodyBold: "700",
  textDisplayXl: "76px", textDisplayL: "50px", textDisplayM: "38px",
  textDisplayS: "30px", textDisplayXs: "22px",
  textBodyL: "18px", textBodyM: "16px", textBodyS: "15px", textBodyXs: "13.5px",
  textMentionS: "11.5px", textKicker: "11px",
  leadingDisplay: "1.05", leadingTitle: "1.15", leadingBody: "1.55", leadingRoomy: "1.6",
  trackingTitle: "-0.02em", trackingDisplay: "-0.03em", trackingKicker: "0.14em",
} as const;

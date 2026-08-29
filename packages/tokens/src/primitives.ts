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
    /* L'abricot des APLATS. Le clair est une pastille — un point qui signale un
       jour ; posé en fond de bouton ou de bandeau, il ne tient pas le contraste
       sous un texte. Deux emplois, deux valeurs : la pastille garde le premier. */
    apricotDeep: "#E3A971",
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
    // Le fond du bouton destructeur pendant l'appui. Sur un téléphone il n'y a
    // pas de survol : la pression est le seul retour que reçoit le doigt, et le
    // web l'obtenait par filter: brightness(), qui n'existe pas en natif.
    errorPress: "#8E1E17",
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
    apricotDeep: "#E3A971",
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
    errorPress: "#C9635B",
    infoBg: "#2E2945",
    successBg: "#163024",
    warningBg: "#322814",
    errorBg: "#35191A",
    onApricot: "#3A2413",
  },
} as const;

export type Theme = keyof typeof primitives;
export type PrimitiveName = keyof typeof primitives.light | keyof typeof primitives.dark;

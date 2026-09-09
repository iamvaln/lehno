/* Lehno — les tokens, portables. RÉFÉRENCE, PAS SOURCE.
 *
 * Ce fichier montre la FORME attendue — objet JS, thème en argument,
 * interligne absolu. Ses valeurs doivent être dérivées de packages/tokens à la
 * compilation, jamais recopiées : une recopie a déjà divergé une fois sur le
 * gris de mention, et c'est le test de contraste du dépôt qui l'a trouvée.
 *
 * Les valeurs sont celles de tokens/*.css, à l'identique : c'est la seule
 * partie du système qui traverse sans réécriture. Ce qui change, c'est la
 * forme — un objet JS au lieu de variables CSS, parce que React Native ne
 * résout pas var().
 *
 * Le thème se passe en argument (theme(nuit)) plutôt que par une classe sur
 * body : RN n'a pas de cascade, donc un thème ne peut pas s'hériter — il se
 * transporte. */

export const base = {
  paper: "#FFFFFF", ink: "#221F2B",
  violet: "#7B6BB7", violetDeep: "#5A4B93", violetPress: "#4A3D7C",
  lilac: "#EDEAF7", apricot: "#F0CFB4",
  /* Un seul gris de texte en thème clair : il n'existe pas de gris plus clair
     qui passe 4,5:1 sur le lilas. Pas de « greyMention » — le token existait,
     il a été supprimé des deux côtés pour qu'aucune plateforme ne le rende
     autrement que l'autre. */
  greyText: "#6B6579",
  rule: "#EDEBF2", ruleStrong: "#E2DDF0",

  night: "#17161F", nightCard: "#1B1928", lilacNight: "#2E2945",
  violetLight: "#9C8BD8", violetLightHi: "#B0A2E2", violetLightLo: "#8877CC",
  violetTint: "#C3B4EE", bandNight: "#41357E",
  nightText: "#F2F0F7", nightMuted: "#B9B4C6", nightMention: "#9A94A8",
  nightRule: "#2A2836", nightRule2: "#3D3757", nightEdge: "#726C96",

  info: "#5A4B93", success: "#166B43", warning: "#8A5A00", error: "#B3261E",
  infoNight: "#C3B4EE", successNight: "#7ED9A6",
  warningNight: "#E3B25C", errorNight: "#F2837A"
};

/* Le thème sombre rejoue la palette, il ne l'inverse pas : deux couleurs
   changent de valeur, une troisième change de rôle. */
export function theme(nuit) {
  const b = base;
  return nuit ? {
    surfacePage: b.night, surfacePanel: b.lilacNight, surfaceCard: b.nightCard,
    surfaceBand: b.bandNight, onBand: b.nightText,
    textBody: b.nightText, textSecondary: b.nightMuted, textMention: b.nightMention,
    textAccent: b.violetTint, textOnAccent: "#15131D",
    action: b.violetLight, actionPress: b.violetLightLo, actionEdge: b.nightEdge,
    actionQuietBg: b.lilacNight,
    borderHairline: b.nightRule, borderObject: b.nightRule2, focusRing: b.violetLight,
    celebrate: b.apricot, onCelebrate: "#3A2413",
    fbInfo: b.infoNight, fbInfoBg: "#2E2945",
    fbSuccess: b.successNight, fbSuccessBg: "#163024",
    fbWarning: b.warningNight, fbWarningBg: "#322814",
    fbError: b.errorNight, fbErrorBg: "#35191A", fbErrorPress: "#C9635B"
  } : {
    surfacePage: b.paper, surfacePanel: b.lilac, surfaceCard: b.paper,
    surfaceBand: b.ink, onBand: b.paper,
    textBody: b.ink, textSecondary: b.greyText, textMention: b.greyText,
    textAccent: b.violetDeep, textOnAccent: b.paper,
    action: b.violet, actionPress: b.violetPress, actionEdge: b.violet,
    actionQuietBg: b.lilac,
    borderHairline: b.rule, borderObject: b.ruleStrong, focusRing: b.violet,
    celebrate: b.apricot, onCelebrate: "#7A4A22",
    fbInfo: b.info, fbInfoBg: "#EDEAF7",
    fbSuccess: b.success, fbSuccessBg: "#E6F4EC",
    fbWarning: b.warning, fbWarningBg: "#FBF0DC",
    fbError: b.error, fbErrorBg: "#FBEAE8", fbErrorPress: "#8E1E17"
  };
}

/* Les familles nomment des INSTANCES STATIQUES, pas des axes : Fraunces est
   variable et son support l'est aussi sur Android. Les réglages de marque
   (SOFT 40, WONK 1) sont cuits dans les .ttf, livrés au lot 0 : ces huit noms
   sont ceux des fichiers. */
export const font = {
  displayRegular: "Fraunces-Regular",
  displayMedium: "Fraunces-Medium",
  displayItalic: "Fraunces-Italic",
  bodyRegular: "Karla-Regular",
  bodyMedium: "Karla-Medium",
  bodySemiBold: "Karla-SemiBold",
  bodyBold: "Karla-Bold"
};

export const size = {
  displayXl: 76, displayL: 50, displayM: 38, displayS: 30, displayXs: 22,
  bodyL: 18, bodyM: 16, bodyS: 15, bodyXs: 13.5, mention: 11.5, kicker: 11,
  tab: 11, tabSerre: 10.5
};

/* En CSS l'interlignage est un facteur ; en RN c'est une valeur absolue. La
   conversion se fait donc à l'usage : lineHeight(size.bodyM, 1.55). */
export const lineHeight = (px, facteur) => Math.round(px * facteur);
export const leading = { display: 1.05, title: 1.15, body: 1.55 };

export const space = {
  2: 2, 4: 4, 6: 6, 8: 8, 10: 10, 12: 12, 14: 14, 16: 16,
  20: 20, 24: 24, 28: 28, 32: 32, 40: 40, 44: 44, 56: 56
};

export const radius = {
  xs: 8, sm: 10, md: 12, lg: 13, xl: 18, xxl: 22, pill: 999
};

export const touchMin = 44;

/* Deux courbes, trois durées — celles du logo animé. Rien ne rebondit. */
export const motion = {
  state: 120, enter: 220, screen: 340,
  easePose: [0.22, 0.8, 0.24, 1],
  easeTraverse: [0.36, 0, 0.16, 1]
};

import { describe, expect, it } from "vitest";
import { nativeBorder, nativeTouchMin, resolve } from "@lehno/tokens";
import { RANGS_DE_BOUTON, rangsDuBouton, styleDuBouton } from "./Button.styles.js";

const CLAIR = resolve("light");
const SOMBRE = resolve("dark");

describe("les rangs du bouton", () => {
  /* Le survol n'existe pas sur un téléphone : la pression est le seul retour
     que reçoit le doigt. Le premier port avait donné au rang destructeur un
     fond pressé identique à son fond au repos — le bouton le plus grave du
     système ne répondait pas au toucher, et rien ne le signalait. Ce test
     généralise le défaut à tous les rangs plutôt qu'à celui qui l'a révélé. */
  it("chaque rang a un état pressé qui se voit, dans les deux thèmes", () => {
    for (const couleurs of [CLAIR, SOMBRE]) {
      const rangs = rangsDuBouton(couleurs);
      for (const nom of RANGS_DE_BOUTON) {
        expect(rangs[nom].fondPresse, nom).not.toBe(rangs[nom].fond);
      }
    }
  });

  // Le rang « text » n'est pas une surface : ni fond ni contour au repos, sans
  // quoi il ne se distinguerait plus du rang « outline ».
  it("le rang text ne pose ni fond ni contour au repos", () => {
    const rangs = rangsDuBouton(CLAIR);
    expect(rangs.text.fond).toBe("transparent");
    expect(rangs.text.bord).toBe("transparent");
  });

  // En thème sombre, du blanc sur violet clair ne mesure que 2,96:1 : c'est de
  // l'encre qu'il faut. La règle vit dans les jetons, le bouton la suit.
  it("le libellé plein prend la couleur que la charte pose sur l'action", () => {
    expect(rangsDuBouton(SOMBRE).primary.texte).toBe(SOMBRE.textOnAccent);
    expect(rangsDuBouton(CLAIR).primary.texte).toBe(CLAIR.textOnAccent);
  });
});

describe("le style du bouton", () => {
  // 44, comme le bouton mobile du web et comme la charte. Le pilote affichait
  // 48 en le disant « de la charte » : c'était une valeur de confort déguisée
  // en règle.
  it("ne descend jamais sous la cible tactile de la charte", () => {
    expect(styleDuBouton({ couleurs: CLAIR }).conteneur.minHeight).toBe(nativeTouchMin);
  });

  it("montre l'état pressé, et lui seul, quand le doigt appuie", () => {
    const rangs = rangsDuBouton(CLAIR);
    const repos = styleDuBouton({ couleurs: CLAIR });
    const presse = styleDuBouton({ couleurs: CLAIR, presse: true });
    expect(repos.conteneur.backgroundColor).toBe(rangs.primary.fond);
    expect(presse.conteneur.backgroundColor).toBe(rangs.primary.fondPresse);
  });

  // Un bouton désactivé ne réagit pas au doigt : lui laisser son état pressé
  // promettrait une action qui n'arrivera pas.
  it("ignore la pression quand il est désactivé", () => {
    const style = styleDuBouton({ couleurs: CLAIR, desactive: true, presse: true });
    expect(style.conteneur.backgroundColor).toBe(rangsDuBouton(CLAIR).primary.fond);
    expect(style.conteneur.opacity).toBe(0.45);
  });

  /* Le filet vient de la charte, pas d'un chiffre écrit ici. Le pilote posait
     hairlineWidth × 2, qui rend 0,67 sur un écran 3x et 1 sur un 2x : la
     bordure changeait d'épaisseur selon l'appareil. */
  it("prend son filet dans la charte", () => {
    expect(styleDuBouton({ couleurs: CLAIR }).conteneur.borderWidth).toBe(nativeBorder.width);
  });

  // « full » étire le bouton ; sinon il se cale à sa largeur de contenu. Sans
  // alignSelf, un bouton dans une colonne s'étire toujours.
  it("ne s'étire que si on le lui demande", () => {
    expect(styleDuBouton({ couleurs: CLAIR }).conteneur.alignSelf).toBe("flex-start");
    expect(styleDuBouton({ couleurs: CLAIR, pleineLargeur: true }).conteneur.alignSelf).toBe("stretch");
  });

  // Le web l'obtenait par currentColor, notion absente de RN. Sans injection,
  // une icône reste noire dans un bouton violet.
  it("donne à l'icône la couleur du libellé qu'elle accompagne", () => {
    const style = styleDuBouton({ couleurs: CLAIR, rang: "destructive" });
    expect(style.couleurIcone).toBe(style.libelle.color);
  });

  // Le châssis iPhone SE existe pour révéler les libellés trop longs, pas pour
  // les cacher — et l'anglais les allonge d'un tiers. Le bouton grandit donc.
  it("laisse le libellé s'étendre plutôt que de le tronquer", () => {
    expect(styleDuBouton({ couleurs: CLAIR }).libelle.flexShrink).toBe(1);
  });
});

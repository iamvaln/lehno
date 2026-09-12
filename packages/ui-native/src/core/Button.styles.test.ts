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

  /* Un bouton désactivé ne réagit pas au doigt : lui laisser son état pressé
     promettrait une action qui n'arrivera pas. On compare les DEUX états
     désactivés entre eux plutôt qu'à une couleur écrite ici — sans quoi le test
     décrit une implantation et tombe à la première retouche de la charte. */
  it("ignore la pression quand il est désactivé", () => {
    const repos = styleDuBouton({ couleurs: CLAIR, desactive: true });
    const presse = styleDuBouton({ couleurs: CLAIR, desactive: true, presse: true });
    expect(presse.conteneur.backgroundColor).toBe(repos.conteneur.backgroundColor);
    expect(presse.conteneur.backgroundColor).not.toBe(rangsDuBouton(CLAIR).primary.fondPresse);
  });

  /* DÉSACTIVÉ SE PEINT, IL NE S'ESTOMPE PAS.

     `opacity: 0.45` sur le conteneur détruisait la lisibilité : l'opacité
     composite fond ET texte contre la page, le fond blanchit, et le blanc du
     libellé NE PEUT PAS pâlir. Mesuré à l'écran sur « Envoyez-moi un code » :
     1,81:1, quand WCAG demande 4,5:1 pour du texte normal et 3:1 même pour du
     grand. C'est le PREMIER état que voit qui ouvre l'application.

     Le test interdit le retour de l'opacité et vérifie que les deux couleurs
     changent ensemble : peindre le fond sans repeindre le texte laisserait du
     blanc sur du pâle, c'est-à-dire le même défaut. */
  it("se peint au lieu de s'estomper quand il est désactivé", () => {
    const eteint = styleDuBouton({ couleurs: CLAIR, desactive: true });
    const vif = styleDuBouton({ couleurs: CLAIR });
    expect(eteint.conteneur.opacity).toBeUndefined();
    expect(eteint.conteneur.backgroundColor).toBe(CLAIR.actionQuietBg);
    expect(eteint.libelle.color).toBe(CLAIR.textMention);
    expect(eteint.libelle.color).not.toBe(vif.libelle.color);
  });

  // L'icône suit le libellé : blanche sur un fond pâle, elle disparaîtrait
  // exactement comme le mot.
  it("éteint l'icône avec le libellé", () => {
    const eteint = styleDuBouton({ couleurs: CLAIR, desactive: true });
    expect(eteint.couleurIcone).toBe(eteint.libelle.color);
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
    expect(styleDuBouton({ couleurs: CLAIR, pleineLargeur: true }).conteneur.alignSelf).toBe("stretch");
  });

  /* IL SE CENTRE, il ne se colle pas au début. `alignSelf` l'emporte sur
     l'`alignItems` du parent : avec « flex-start », un écran centré ne POUVAIT
     PAS centrer son bouton, et chaque écran rattrapait à la main — ou oubliait.
     C'est le défaut qu'on a vu sur les états vides et sur le renvoi du code. */
  it("se centre quand il ne prend pas toute la largeur", () => {
    expect(styleDuBouton({ couleurs: CLAIR }).conteneur.alignSelf).toBe("center");
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

/* LA GARDE QUI MANQUAIT — et son absence a laissé passer 1,81:1.
 *
 * `boutons-lisibles.test.ts` côté mobile vérifie qu'un bouton d'icône porte un
 * libellé d'accessibilité. Personne ne vérifiait qu'on VOIT ce libellé. Le
 * défaut était donc invisible aux tests par construction : la couleur était
 * juste, le rendu correct, et le mot illisible.
 *
 * On mesure le rapport WCAG entre le libellé et son fond, dans les DEUX
 * thèmes. Une charte se retouche ; ce test dit alors tout de suite si la
 * retouche a coûté la lisibilité, au lieu de le laisser découvrir sur un
 * téléphone.
 */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const canal = (i: number): number => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("on voit ce qui est écrit sur un bouton", () => {
  // 4,5:1 — le seuil WCAG AA pour du texte normal. Le libellé d'un bouton est
  // à 15 pt : il ne bénéficie pas de l'indulgence accordée au grand texte.
  const SEUIL = 4.5;

  for (const [nom, couleurs] of [["clair", CLAIR], ["sombre", SOMBRE]] as const) {
    it(`garde le libellé lisible en thème ${nom}, bouton vif`, () => {
      const style = styleDuBouton({ couleurs });
      expect(contraste(style.libelle.color as string, style.conteneur.backgroundColor as string))
        .toBeGreaterThanOrEqual(SEUIL);
    });

    /* CELUI-CI EST LE CAS RÉEL. Mesuré à l'écran avant correction : 1,81:1 sur
       « Envoyez-moi un code », le premier état que voit qui ouvre
       l'application. `opacity` compositait fond et texte contre la page ; le
       fond blanchissait, et le blanc du libellé ne pouvait pas pâlir. */
    it(`garde le libellé lisible en thème ${nom}, bouton éteint`, () => {
      const style = styleDuBouton({ couleurs, desactive: true });
      expect(contraste(style.libelle.color as string, style.conteneur.backgroundColor as string))
        .toBeGreaterThanOrEqual(SEUIL);
    });
  }
});


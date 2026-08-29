import { describe, expect, it } from "vitest";
import { contrastRatio, nativeTouchMin, resolve } from "@lehno/tokens";
import {
  DUREE_PAR_DEFAUT, INTENTIONS_D_ACCUSE, delaiDEffacement, styleDAccuse,
} from "./Toast.styles.js";

const CLAIR = resolve("light");
const SOMBRE = resolve("dark");
const THEMES = [["clair", CLAIR], ["sombre", SOMBRE]] as const;

describe("l'accusé", () => {
  /* LE DÉFAUT DE LA TRADUCTION MOT À MOT. Le web posait la couleur de retour du
     thème courant sur `--surface-inverse`. Traduit tel quel, le rouge du thème
     clair (#B3261E) se retrouve sur l'encre de la bande : 2,47:1 — un signe
     qu'on ne voit pas, sur l'accusé qui dit qu'une action a échoué. En sombre
     c'est pire : 1,58:1.

     Le test ne vérifie pas « le signe d'erreur est visible » : il mesure les
     trois signes contre le fond réel de l'accusé, dans les deux thèmes. Un
     quatrième signe ajouté demain passera par la même mesure. */
  it("donne à chaque signe de quoi se voir sur sa propre bande, dans les deux thèmes", () => {
    for (const [nom, couleurs] of THEMES) {
      for (const intention of INTENTIONS_D_ACCUSE) {
        const s = styleDAccuse({ couleurs, intention });
        const fond = String(s.conteneur.backgroundColor);
        expect(contrastRatio(s.couleurSigne, fond), `${nom}/${intention}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  /* L'intention teinte le signe, jamais le texte. Poser la couleur de retour
     sur la phrase entière la rendrait illisible pour la même raison, et sur
     bien plus de pixels. */
  it("garde le texte dans l'encre de la bande, quelle que soit l'intention", () => {
    for (const [nom, couleurs] of THEMES) {
      for (const intention of INTENTIONS_D_ACCUSE) {
        const s = styleDAccuse({ couleurs, intention });
        expect(s.texte.color, `${nom}/${intention}`).toBe(couleurs.onBand);
        expect(s.action.color, `${nom}/${intention}`).toBe(couleurs.onBand);
        expect(contrastRatio(String(s.texte.color), String(s.conteneur.backgroundColor)))
          .toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  /* Il flotte au-dessus du contenu sans ombre — ce produit n'en a pas — donc
     c'est son fond seul qui l'en détache. Le poser sur la surface de page le
     ferait fondre dans l'écran qu'il recouvre. */
  it("ne se confond jamais avec la page qu'il recouvre", () => {
    for (const [nom, couleurs] of THEMES) {
      const s = styleDAccuse({ couleurs });
      expect(s.conteneur.backgroundColor, nom).toBe(couleurs.surfaceBand);
      expect(s.conteneur.backgroundColor, nom).not.toBe(couleurs.surfacePage);
      expect(s.conteneur).not.toHaveProperty("shadowColor");
    }
  });

  it("donne à chaque intention son signe", () => {
    expect(styleDAccuse({ couleurs: CLAIR, intention: "error" }).signe).toBe("circle-x");
    expect(styleDAccuse({ couleurs: CLAIR, intention: "success" }).signe).toBe("circle-check");
    expect(styleDAccuse({ couleurs: CLAIR, intention: "info" }).signe).toBe("info");
  });

  // Une erreur interrompt ; le reste informe. Même règle que le bandeau.
  it("n'interrompt le lecteur d'écran que pour une erreur", () => {
    expect(styleDAccuse({ couleurs: CLAIR, intention: "error" }).urgence).toBe("assertive");
    for (const intention of ["info", "success"] as const) {
      expect(styleDAccuse({ couleurs: CLAIR, intention }).urgence, intention).toBe("polite");
    }
  });

  /* Les deux commandes sont voisines dans une même ligne : un hitSlop les
     ferait se recouvrir, et le doigt qui vise « Annuler » tomberait sur
     « Fermer ». Elles atteignent donc la cible par leur propre hauteur. */
  /* Le creux du bas — barre d'accueil, barre d'onglets. Posé à seize points du
     bord, l'accusé passe sous l'indicateur d'accueil de l'iPhone et sa
     fermeture devient intouchable : le même défaut que sous les feuilles, sur
     un composant qui vit précisément là. */
  it("dégage toujours le creux du bas, quel qu'il soit", () => {
    const nu = Number(styleDAccuse({ couleurs: CLAIR }).conteneur.bottom);
    expect(nu).toBeGreaterThan(0);
    for (const creux of [0, 34, 83]) {
      const pose = Number(styleDAccuse({ couleurs: CLAIR, insetBas: creux }).conteneur.bottom);
      expect(pose, `creux ${creux}`).toBeGreaterThanOrEqual(creux);
      expect(pose, `creux ${creux}`).toBeGreaterThanOrEqual(nu);
    }
  });

  it("donne à ses deux commandes une cible tactile entière", () => {
    const s = styleDAccuse({ couleurs: CLAIR });
    expect(s.commande.minHeight).toBe(nativeTouchMin);
    expect(s.fermeture.minHeight).toBe(nativeTouchMin);
    expect(s.fermeture.minWidth).toBe(nativeTouchMin);
  });
});

describe("l'effacement de l'accusé", () => {
  it("s'efface au bout de six secondes par défaut", () => {
    expect(delaiDEffacement({ effacable: true })).toBe(DUREE_PAR_DEFAUT);
  });

  /* Une durée nulle fige l'accusé exprès : c'est ce que veut une erreur, qui
     reste sous les yeux. Sans cette porte, `setTimeout(fn, 0)` l'effacerait au
     premier battement — l'inverse exact de ce que l'appel demandait. */
  it("se fige quand la durée est nulle", () => {
    expect(delaiDEffacement({ duree: 0, effacable: true })).toBeNull();
    expect(delaiDEffacement({ duree: -1, effacable: true })).toBeNull();
  });

  /* Sans `onDismiss`, l'accusé n'a personne à prévenir. Armer le minuteur quand
     même laisserait croire qu'il disparaît : il resterait à l'écran, et rien
     n'expliquerait pourquoi. */
  it("n'arme aucun minuteur quand rien n'écoute l'effacement", () => {
    expect(delaiDEffacement({ effacable: false })).toBeNull();
    expect(delaiDEffacement({ duree: 3000, effacable: false })).toBeNull();
  });
});

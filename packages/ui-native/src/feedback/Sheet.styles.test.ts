import { describe, expect, it } from "vitest";
import { nativeRadius, nativeTouchMin, resolve } from "@lehno/tokens";
import { chassisDeFeuille } from "./Sheet.styles.js";

const CLAIR = resolve("light");
const SOMBRE = resolve("dark");
const THEMES = [["clair", CLAIR], ["sombre", SOMBRE]] as const;

describe("le châssis des feuilles", () => {
  /* Elle monte du bord bas de l'écran. Arrondir les quatre coins en ferait une
     carte posée, et le liseré de page qu'on verrait dessous démentirait le
     mouvement — la feuille n'aurait plus l'air de venir de nulle part. */
  it("n'arrondit que les deux coins par lesquels elle entre", () => {
    const c = chassisDeFeuille({ couleurs: CLAIR });
    expect(c.feuille.borderTopLeftRadius).toBe(nativeRadius["2xl"]);
    expect(c.feuille.borderTopRightRadius).toBe(nativeRadius["2xl"]);
    expect(c.feuille.borderBottomLeftRadius).toBe(0);
    expect(c.feuille.borderBottomRightRadius).toBe(0);
  });

  /* L'INDICATEUR D'ACCUEIL. Le web n'avait rien sous ses boutons : il n'a pas
     d'encoche. Porté tel quel, le bouton de refus se glissait sous la barre
     d'accueil de l'iPhone, et le doigt qui le visait renvoyait à l'accueil.

     Le test ne fixe pas un nombre : il vérifie que l'encoche, quelle qu'elle
     soit, est toujours dégagée, et qu'un appareil qui n'en a pas garde tout de
     même un retrait. */
  it("dégage toujours l'encoche du bas, quelle qu'elle soit", () => {
    const sansEncoche = chassisDeFeuille({ couleurs: CLAIR }).feuille.paddingBottom;
    expect(sansEncoche).toBeGreaterThan(0);
    for (const encoche of [0, 20, 34, 48]) {
      const retrait = chassisDeFeuille({ couleurs: CLAIR, insetBas: encoche }).feuille.paddingBottom;
      expect(Number(retrait), `encoche ${encoche}`).toBeGreaterThanOrEqual(encoche);
      expect(Number(retrait), `encoche ${encoche}`).toBeGreaterThanOrEqual(Number(sansEncoche));
    }
  });

  /* Le voile éteint l'écran ; il ne prend pas de thème. `surfaceBand` vire au
     violet en sombre : le prendre au thème courant teinterait l'écran au lieu
     de l'éteindre, et la question paraîtrait sur un fond de fête. */
  it("éteint l'écran de la même encre dans les deux thèmes", () => {
    const [, clair] = THEMES[0];
    const [, sombre] = THEMES[1];
    const a = chassisDeFeuille({ couleurs: clair }).voile;
    const b = chassisDeFeuille({ couleurs: sombre }).voile;
    expect(a.backgroundColor).toBe(b.backgroundColor);
    expect(a.backgroundColor).not.toBe(sombre.surfaceBand);
  });

  /* Assez opaque pour que l'en-tête cesse d'exister : sinon le bouton retour
     reste visible, donc cliquable dans l'esprit, pendant qu'on répond. */
  it("couvre son parent entier, d'un voile qu'on ne traverse pas du regard", () => {
    const v = chassisDeFeuille({ couleurs: CLAIR }).voile;
    expect(v.position).toBe("absolute");
    expect([v.top, v.left, v.right, v.bottom]).toEqual([0, 0, 0, 0]);
    expect(Number(v.opacity)).toBeGreaterThanOrEqual(0.5);
  });

  /* La poignée dit d'où vient la feuille, elle ne se touche pas : quatre points
     de haut, très loin de la cible tactile. Le jour où quelqu'un la grossit
     pour la rendre saisissable, c'est un geste de glissement qu'il faut
     écrire — pas une barre plus épaisse. */
  it("garde une poignée qui se lit sans se toucher", () => {
    const p = chassisDeFeuille({ couleurs: CLAIR }).poignee;
    expect(Number(p.height)).toBeLessThan(nativeTouchMin);
    expect(p.alignSelf).toBe("center");
  });

  // La feuille se pose sur la surface des cartes, pas sur celle de la page :
  // en sombre les deux diffèrent, et une feuille sur fond de page se fondrait
  // dans l'écran qu'elle recouvre.
  it("se pose sur la surface des objets, dans les deux thèmes", () => {
    for (const [nom, couleurs] of THEMES) {
      expect(chassisDeFeuille({ couleurs }).feuille.backgroundColor, nom).toBe(couleurs.surfaceCard);
    }
  });
});

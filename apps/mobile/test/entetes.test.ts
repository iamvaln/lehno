import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fr } from "../messages/fr.js";
import { en } from "../messages/en.js";

/* UN ÉCRAN EMPILÉ DIT OÙ L'ON EST.
 *
 * Huit écrans ne le disaient pas. On arrivait dessus par une rangée des
 * réglages — « Sécurité et connexions », « Mes données », « Rappels et
 * notifications » — et l'écran s'ouvrait sur une flèche seule, puis directement
 * sur l'étiquette de son premier bloc, en petites capitales grises. Rien ne
 * répondait à « où suis-je ». Vu à l'appareil sur la sécurité et sur les
 * reprises ; les six autres écrivaient le même en-tête, au caractère près.
 *
 * La planche, elle, porte un `AppHeader` avec un nom sur TOUS les écrans
 * empilés. Ces huit-là emploient désormais `ScreenHeader`.
 *
 * Le test lit la SOURCE : `react-native` est typé Flow et Vitest ne le charge
 * pas, donc on ne peut pas rendre les écrans.
 */

/* La table est ÉCRITE À LA MAIN, et c'est le but — comme celle des écrans
   gouvernés. Un écran qui perdrait son en-tête, ou qui reviendrait à dessiner
   sa flèche à la main, fait tomber le test ; et le libellé qu'il annonce doit
   exister dans les deux langues. */
const ENTETES: Readonly<Record<string, string>> = {
  profil: "enteteProfil",
  securite: "enteteSecurite",
  paiement: "entetePaiement",
  rappels: "enteteRappels",
  donnees: "enteteDonnees",
  aide: "enteteAide",
  reservations: "enteteReservations",
  reprises: "enteteReprises",
  listes: "enteteListes",
  monmur: "enteteMonMur",
  collecte: "enteteCollecte",
  valider: "enteteValider",
  mouvements: "enteteMouvements",
};

const source = (nom: string): string =>
  readFileSync(new URL(`../app/(app)/${nom}.tsx`, import.meta.url), "utf8");

describe("les écrans empilés disent où l'on est", () => {
  for (const [ecran, cle] of Object.entries(ENTETES)) {
    it(`${ecran} porte son en-tête`, () => {
      expect(source(ecran)).toContain(`<ScreenHeader titre={t.${cle}}`);
    });

    /* LA FLÈCHE À LA MAIN EST LE DÉFAUT LUI-MÊME : c'est elle qui tenait lieu
       d'en-tête. La retrouver ici voudrait dire qu'on est revenu en arrière. */
    it(`${ecran} ne redessine pas sa flèche`, () => {
      expect(source(ecran)).not.toContain("accessibilityLabel={t.retour}");
    });

    it(`« ${cle} » est traduit dans les deux langues`, () => {
      expect(fr[cle as keyof typeof fr], "fr").toBeTruthy();
      expect(en[cle as keyof typeof en], "en").toBeTruthy();
    });
  }

  /* Les libellés sont ceux de la planche, et ils sont plus COURTS que la rangée
     qui y mène : « Sécurité » pour « Sécurité et connexions ». La rangée
     annonce, l'en-tête situe — et il partage sa ligne avec la flèche, donc il
     ne peut pas être une phrase. */
  it("garde des noms d'écran, pas des phrases", () => {
    for (const cle of Object.values(ENTETES)) {
      const libelle = fr[cle as keyof typeof fr] as string;
      expect(libelle.length, cle).toBeLessThanOrEqual(20);
      expect(libelle, cle).not.toContain(".");
    }
  });
});

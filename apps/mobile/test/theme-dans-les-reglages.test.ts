import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLES_DE_THEME, THEMES_ORDONNES } from "../lib/libelles.js";
import { fr } from "../messages/fr.js";
import { en } from "../messages/en.js";

/* LE THÈME VIT DANS LES RÉGLAGES, ET S'APPLIQUE SOUS LE DOIGT — §9 du relevé
 * des essais. Il vivait dans le profil, et n'agissait qu'à l'enregistrement :
 * deux défauts distincts, la même correction.
 *
 * LE PROFIL PORTE QUI L'ON EST ; LES RÉGLAGES PORTENT CE QUI RÈGLE LE PRODUIT.
 * La langue avait déjà fait ce chemin — le thème le fait à son tour.
 */
const profil = (): string =>
  readFileSync(new URL("../app/profil.tsx", import.meta.url), "utf8");

const reglages = (): string =>
  readFileSync(new URL("../app/(app)/reglages/index.tsx", import.meta.url), "utf8");

describe("le thème quitte le profil pour les réglages", () => {
  it("le profil n'offre plus de sélecteur de thème", () => {
    expect(profil()).not.toContain("THEMES_ORDONNES");
  });

  it("les réglages portent le sélecteur de thème", () => {
    const s = reglages();
    expect(s).toContain("THEMES_ORDONNES");
    expect(s).toContain("champTheme");
  });

  // Immédiat : `changeLeTheme` doit s'appeler depuis le `onPress` de la
  // bascule elle-même, jamais depuis un geste d'enregistrement — et cet
  // écran n'a d'ailleurs pas de bouton « Enregistrer ».
  it("les réglages n'ont pas de bouton d'enregistrement", () => {
    expect(reglages()).not.toContain("t.enregistrer");
  });

  it("le choix de thème appelle le changement au premier appui", () => {
    const s = reglages();
    expect(s).toContain("onPress={() => changeLeTheme(cle)}");
  });
});

/* CE QUE LE SÉLECTEUR DOIT TENIR, une fois arrivé dans les réglages.
 *
 * Le bloc ci-dessus éprouve le DÉPLACEMENT — que le profil n'en ait plus, que
 * les réglages l'aient. Celui-ci éprouve ce que le sélecteur fait, et ce sont
 * deux questions distinctes : le thème pourrait être au bon endroit et n'offrir
 * que deux positions, ou ne rien annoncer aux lecteurs d'écran.
 *
 * Ces cas viennent d'une branche fermée sans fusion (`6518237`), dont
 * l'implémentation faisait double emploi avec `60b3e0c` — mais dont les
 * épreuves, elles, n'existaient nulle part ailleurs. Les comportements sont
 * dans le code depuis ce jour-là ; rien ne les gardait.
 *
 * LES QUATRE DERNIERS LISENT LA SOURCE, faute de rendu dans cette suite. Ils
 * attrapent donc la DISPARITION d'une ligne, pas une régression de
 * comportement — et ils tombent aussi sur un renommage inoffensif. C'est le
 * prix, et il se paie en les corrigeant ; l'inverse, du code que rien ne garde,
 * se paie chez l'utilisateur. */
describe("le sélecteur d'apparence", () => {
  /* « SYSTÈME » N'EST PAS UNE TROISIÈME PALETTE, c'est l'ABSENCE de choix. Une
     bascule à deux positions la perdrait au premier passage en sombre du
     téléphone : quelqu'un qui n'a jamais choisi resterait figé dans ce que son
     système faisait ce jour-là. */
  it("a trois positions — system, light, dark — jamais un booléen", () => {
    expect(THEMES_ORDONNES).toEqual(["system", "light", "dark"]);
  });

  it("nomme chacune dans les deux langues", () => {
    for (const cle of THEMES_ORDONNES) {
      expect(fr[CLES_DE_THEME[cle]], `fr : ${cle}`).toBeTruthy();
      expect(en[CLES_DE_THEME[cle]], `en : ${cle}`).toBeTruthy();
    }
  });

  /* Les positions viennent de la TABLE, pas d'une liste réécrite à côté : le
     jour où une valeur s'ajoute, une seconde liste se tairait. */
  it("déduit ses positions de la table des thèmes", () => {
    expect(reglages()).toMatch(/THEMES_ORDONNES\.map/);
  });

  /* PAS DE `radiogroup` : React Native ne connaît pas ce rôle. Chaque position
     est un bouton qui porte `accessibilityState.selected`, seul moyen
     d'annoncer « sélectionné » à VoiceOver comme à TalkBack. */
  it("annonce aux lecteurs d'écran laquelle est retenue", () => {
    expect(reglages()).toMatch(/accessibilityState=\{\{ selected: preference === cle \}\}/);
  });

  /* DEUX ÉCRITURES, ET L'UNE SANS L'AUTRE PASSE INAPERÇUE DANS LA SÉANCE MÊME.
     Le fournisseur change ce qu'on voit tout de suite ; le disque garde le
     choix pour le prochain lancement. Sans le second, l'apparence choisie
     s'évapore à la fermeture — et on ne le découvre qu'au lancement suivant. */
  it("applique le choix tout de suite, et le garde pour le prochain lancement", () => {
    const s = reglages();
    expect(s).toMatch(/choisisLeTheme\(vers\)/);
    expect(s).toMatch(/poseLApparence\(vers\)/);
  });

  // Reposer la position active ne réécrit rien — ni l'affichage, ni le disque,
  // ni le profil au serveur.
  it("ne fait rien quand on repose la position déjà retenue", () => {
    expect(reglages()).toMatch(/if \(vers === preference\) return;/);
  });
});

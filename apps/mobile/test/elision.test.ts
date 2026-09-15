import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* AUCUN LIBELLÉ FRANÇAIS NE COLLE UN MOT ÉLIDABLE À UN PRÉNOM.
 *
 * « La wishlist de Awa ». Le dictionnaire concaténait « de » et le nom, et rien
 * nulle part n'élidait. Tous les prénoms à initiale vocalique rendaient la
 * phrase fautive — Awa, Élise, Ines, Omar, Ada —, y compris dans les DEUX
 * titres de pages publiques, celles qu'on envoie à ses proches.
 *
 * Six libellés étaient touchés. Le septième sera écrit par quelqu'un qui n'aura
 * pas lu ce fichier : cette garde balaie donc la source plutôt que d'énumérer
 * les cas connus.
 *
 * ELLE NE REGARDE QUE LE FRANÇAIS. L'anglais dit « Awa's wishlist » et n'a pas
 * cette règle ; l'y chercher ferait tomber le test sur une langue qui va bien.
 */

/* Les mots qui s'élident devant une voyelle. « comme », « avec », « pour » n'en
   sont pas — les chercher ferait refuser « connecté comme Awa », qui est juste. */
const ELIDABLES = ["de", "que", "le", "la", "ce", "ne", "se", "me", "te", "je"];

const source = readFileSync(new URL("../messages/fr.ts", import.meta.url), "utf8");

/* Un libellé qui colle un mot élidable à une interpolation : `"… de " + qui`.
   On ne regarde que les fonctions du dictionnaire — le texte fixe, lui, a déjà
   son élision écrite à la main. */
/* CE QUI DÉSIGNE UNE PERSONNE, et rien d'autre. Le dictionnaire nomme ainsi ses
   paramètres, et la distinction est nécessaire : « le 4 mars » ne s'élide pas,
   « le Awa » n'existe pas. Sans ce filtre, la garde refusait « Rien avant le »
   suivi d'une date — cinq libellés parfaitement corrects. */
const PERSONNES = ["qui", "nom", "prenom", "proche", "pseudo"];

const motif = (): RegExp => new RegExp(
  `"[^"]*\\b(${ELIDABLES.join("|")}) " \\+ (${PERSONNES.join("|")})\\b`, "g");

describe("les libellés français qui nomment quelqu'un", () => {
  it("n'en colle aucun à un prénom", () => {
    const fautifs = [...source.matchAll(motif())].map((m) => m[0]);
    expect(
      fautifs,
      `à corriger par elideBefore() : ${fautifs.join(" · ")}`,
    ).toEqual([]);
  });

  /* LE DÉTECTEUR S'ÉPROUVE LUI-MÊME, sur un échantillon fautif écrit ici.
   *
   * La première version de ce test cherchait seulement si la source interpolait
   * des noms — elle en trouvait, donc elle passait. Mais l'expression du
   * détecteur, elle, était cassée : quatre antislashs au lieu de deux, `\b`
   * devenu « antislash suivi de b ». Elle ne trouvait RIEN, et le test était
   * vert. J'ai posé un septième libellé fautif exprès : il est passé sans un
   * mot.
   *
   * Vérifier que la source contient quelque chose ne prouve pas qu'on sait le
   * reconnaître. Il faut lui donner à reconnaître. */
  it("reconnaît un libellé fautif", () => {
    const echantillon = '  sonde: (qui: string) => "Le portrait de " + qui,';
    expect([...echantillon.matchAll(motif())]).toHaveLength(1);
  });

  it("laisse passer un libellé correct", () => {
    const echantillon = '  sonde: (qui: string) => "Le portrait " + elideBefore("de", qui),';
    expect([...echantillon.matchAll(motif())]).toHaveLength(0);
  });
});

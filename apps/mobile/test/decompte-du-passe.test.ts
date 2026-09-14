import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* AUCUN ÉCRAN NE COMPOSE UN DÉCOMPTE SANS SAVOIR CE QU'IL FAIT D'UNE DATE PASSÉE.
 *
 * `daysUntil` est SIGNÉ. `decompteBarre` écrit « J− » puis le nombre : sur un
 * négatif, cela donne « J−−4 », vu à l'écran sur la liste des dates, qui demande
 * un mois en arrière au serveur — on revient voir ce qu'on a manqué.
 *
 * Sept écrans composent ce décompte. Cinq se gardaient déjà, chacun à sa façon :
 * les trois du carnet bornent par `presseAssezPourSAfficher`, l'occasion et la
 * reprise montrent un jeton à la place. Deux ne se gardaient pas — et l'un des
 * deux avait un test qui gelait le défaut sous un commentaire qui le condamnait.
 *
 * D'où cette garde : elle ne vérifie pas un écran, elle vérifie qu'AUCUN
 * n'échappe à la question. Le huitième sera écrit par quelqu'un qui n'aura pas
 * lu ce fichier.
 *
 * LES DEUX SENS. Une garde nommée pour un écran qui ne compose plus de décompte
 * fait tomber le test : sans quoi la table survit à ce qu'elle décrivait, et
 * c'est elle qu'on relit ensuite comme si elle disait le vrai.
 */

/* CE QUI COMPTE COMME GARDE, et pourquoi chacune en est une. Il n'y a pas de
   forme unique : borner l'entrée et nommer le passé règlent la même question
   par deux chemins, et les deux sont justes. */
const GARDES: Record<string, string> = {
  "app/(app)/dates.tsx": "countdownShape(",
  /* Celui-ci ne se garde pas dans l'écran mais en AMONT : il ne rend que ce que
     `composeLAccueil` lui donne, et cette fonction écarte le passé — « ce qui
     approche » n'est jamais derrière. La garde est donc l'appel lui-même. */
  "app/(app)/accueil.tsx": "composeLAccueil(",
  "app/(app)/occasion.tsx": "t.occPassee",
  "app/(app)/reprises.tsx": "t.repriseDepassee",
  "app/(app)/proches/index.tsx": "presseAssezPourSAfficher(",
  "app/(app)/proches/recherche.tsx": "presseAssezPourSAfficher(",
  "app/(app)/proches/[id].tsx": "presseAssezPourSAfficher(",
};

const fichiers = (racine: string): string[] =>
  readdirSync(racine, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(racine, e.name);
    if (e.isDirectory()) return fichiers(chemin);
    return /\.tsx$/.test(e.name) ? [chemin] : [];
  });

const composeUnDecompte = (texte: string): boolean => /t\.decompteBarre\(/.test(texte);

describe("le décompte face à une date passée", () => {
  const sources = fichiers("app").map((chemin) => ({
    chemin, texte: readFileSync(chemin, "utf8"),
  }));
  const composent = sources.filter((s) => composeUnDecompte(s.texte));

  // Sans ça, une expression rationnelle cassée rendrait tout vert à vide.
  it("trouve bien les écrans qui composent un décompte", () => {
    expect(composent.length).toBeGreaterThan(4);
  });

  it("aucun ne compose sans se garder du passé", () => {
    for (const { chemin, texte } of composent) {
      const garde = GARDES[chemin];
      expect(garde, `${chemin} compose un décompte sans garde connue : « J−−4 » y est possible`)
        .toBeDefined();
      expect(texte.includes(garde!), `${chemin} ne porte plus sa garde « ${garde} »`).toBe(true);
    }
  });

  it("ne garde aucune entrée qui ne décrive plus rien", () => {
    for (const chemin of Object.keys(GARDES)) {
      expect(composent.some((s) => s.chemin === chemin), `${chemin} est listé mais ne compose plus de décompte`)
        .toBe(true);
    }
  });
});

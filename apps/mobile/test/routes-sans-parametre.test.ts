import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* UN ÉCRAN QUI NE PEUT PAS CHARGER DOIT LE DIRE.
 *
 * Une route d'expo-router s'atteint par LIEN PROFOND : la retirer de la
 * navigation ne la ferme pas, et rien ne garantit qu'elle arrive avec ses
 * paramètres. Trois écrans commençaient leur chargement par `if (!id) return`
 * — donc, sans identifiant, ils ne partaient pas ET ne le disaient pas. Leur
 * rendu retombait alors sur `if (x === null)`, c'est-à-dire le squelette de
 * chargement, POUR TOUJOURS : ni contenu, ni état vide, ni erreur, et rien à
 * toucher que la flèche de retour.
 *
 * Vu à l'appareil sur `/collecte` ouvert sans `id` : vingt-cinq secondes de
 * squelette, et il y serait encore.
 *
 * Ces mêmes fichiers portaient déjà la règle en commentaire — « une route
 * s'atteint par lien profond : elle se garde donc elle-même plutôt que de
 * compter sur celui qui l'ouvre ». Elle ne valait que pour le drapeau.
 *
 * LES DEUX SENS. Une dispense qui ne décrit plus rien fait tomber le test :
 * sans quoi elle survit à ce qui la justifiait.
 */

/* CE QUI DISPENSE, ET LA SEULE RAISON QUI VAILLE : l'écran traite l'absence
   explicitement, parce qu'elle veut dire quelque chose chez lui. */
const TRAITENT_L_ABSENCE: Record<string, string> = {
  /* Sans identifiant, cet écran CRÉE plutôt qu'il ne modifie. L'absence n'est
     pas une panne, c'est le mode. */
  "app/(app)/proches/identite.tsx": "const creation = !id;",
};

const fichiers = (racine: string): string[] =>
  readdirSync(racine, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(racine, e.name);
    if (e.isDirectory()) return fichiers(chemin);
    return /\.tsx$/.test(e.name) ? [chemin] : [];
  });

// Un chargement qui renonce faute de paramètre.
const renonce = (texte: string): boolean => /if \(!(id|listeId|personId)\) return;/.test(texte);
/* Il se ferme quand le paramètre manque — ET AVANT TOUT AUTRE RENDU.
 *
 * LA PRÉSENCE NE SUFFIT PAS, et c'est la leçon de ce lot : la garde existait
 * déjà dans deux de ces fichiers, pour le drapeau éteint. Elle était posée
 * APRÈS la condition du squelette, donc elle ne tirait jamais — du code mort
 * sous un commentaire qui affirmait le contraire. Un test qui n'aurait cherché
 * que la ligne l'aurait déclarée verte. */
const seFerme = (texte: string): boolean => {
  const garde = texte.search(/\|\| !(id|listeId|personId)\) return <EcranFerme/);
  if (garde === -1) return false;
  const squelette = texte.indexOf("<LoadingState");
  return squelette === -1 || garde < squelette;
};

describe("une route atteinte sans son paramètre", () => {
  const sources = fichiers("app").map((chemin) => ({
    chemin, texte: readFileSync(chemin, "utf8"),
  }));
  const renoncent = sources.filter((s) => renonce(s.texte));

  // Sans ça, une expression rationnelle cassée rendrait tout vert à vide.
  it("trouve bien des écrans qui renoncent faute de paramètre", () => {
    expect(renoncent.length).toBeGreaterThan(Object.keys(TRAITENT_L_ABSENCE).length);
  });

  it("se ferme plutôt que de charger indéfiniment", () => {
    for (const { chemin, texte } of renoncent) {
      const dispense = TRAITENT_L_ABSENCE[chemin];
      if (dispense !== undefined) {
        expect(texte.includes(dispense), `${chemin} est dispensé mais ne porte plus « ${dispense} »`).toBe(true);
        continue;
      }
      expect(seFerme(texte), `${chemin} renonce à charger sans le dire, ou se ferme APRÈS son squelette — qui gagne, et ne partira jamais`)
        .toBe(true);
    }
  });

  it("ne garde aucune dispense qui ne décrive plus rien", () => {
    for (const chemin of Object.keys(TRAITENT_L_ABSENCE)) {
      expect(renoncent.some((s) => s.chemin === chemin), `${chemin} est listé mais ne renonce plus`)
        .toBe(true);
    }
  });
});

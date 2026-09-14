import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* UNE FEUILLE QUI MONTE EN PLEINE PAGE PASSE PAR `Modal`.
 *
 * Le châssis pose la scène EN ABSOLU, et l'absolu d'une vue native se mesure
 * sur son PARENT, pas sur l'écran. Les deux feuilles du kit s'en accommodent
 * parce que leurs écrans les posent en DERNIER ENFANT de la racine : là, la
 * scène couvre bien tout, et plus rien ne peint après elle.
 *
 * `Avis`, lui, vit au milieu de la page — sous les verdicts d'un portrait, sous
 * un message, sous une idée. Sa scène ne couvrait donc que sa propre boîte : la
 * page restait allumée, et tout ce qui suit dans l'arbre passait PAR-DESSUS la
 * feuille.
 *
 * Ce n'était pas qu'un défaut d'aspect. Vu à l'appareil : le « Refaire » de
 * l'écran tombait pile sur le bouton « Envoyer » de la question. Le doigt qui
 * envoyait son motif lançait une régénération — un crédit dépensé pour avoir
 * répondu à une question. Aucun test ne le voyait : ils rendent la feuille
 * seule, où elle n'a rien au-dessus d'elle.
 *
 * LA TABLE SE LIT DANS LES DEUX SENS. Une feuille non listée doit porter
 * `Modal` ; une feuille listée doit encore se passer de lui ET employer la
 * scène. Sans ce second sens, une dispense survit à ce qui la justifiait, et
 * c'est elle qu'on relit ensuite comme si elle disait le vrai.
 */

/* CE QUI DISPENSE : rien ne peint après elle. Deux façons seulement, et la
   raison de chacune se vérifie d'un coup d'œil au montage. */
const RIEN_NE_PEINT_APRES: Record<string, string> = {
  "../../packages/ui-native/src/feedback/ConfirmSheet.tsx":
    "posée en dernier enfant de la racine par chacun de ses écrans — voir souhait.tsx, securite.tsx",
  "../../packages/ui-native/src/feedback/PaidActionSheet.tsx":
    "posée en dernier enfant de la racine par chacun de ses écrans — voir occasion.tsx, portrait.tsx",
  /* Celle-ci n'est pas posée SUR un écran : elle EST l'écran. `note.tsx` est
     une route, sa scène est la racine, et une route n'a rien au-dessus d'elle.
     `Modal` y ajouterait une seconde couche par-dessus la première. */
  "app/note.tsx": "route à part entière : la scène est la racine de l'écran",
};

const RACINES = ["composants", "app", "../../packages/ui-native/src"];

const fichiers = (racine: string): string[] =>
  readdirSync(racine, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(racine, e.name);
    if (e.isDirectory()) return fichiers(chemin);
    return /\.tsx$/.test(e.name) ? [chemin] : [];
  });

const emploieLaScene = (texte: string): boolean => /style=\{c\.scene\}/.test(texte);
const monteUnModal = (texte: string): boolean => /<Modal\b/.test(texte);

describe("les feuilles montées en pleine page", () => {
  const sources = RACINES.flatMap(fichiers).map((chemin) => ({
    chemin, texte: readFileSync(chemin, "utf8"),
  }));
  const feuilles = sources.filter((s) => emploieLaScene(s.texte));

  // Sans ça, une expression rationnelle cassée rendrait tout le fichier vert à
  // vide : zéro feuille trouvée, zéro exigence, zéro défaut.
  it("trouve bien des feuilles à vérifier", () => {
    expect(feuilles.length).toBeGreaterThan(Object.keys(RIEN_NE_PEINT_APRES).length);
  });

  it("passent par Modal, sauf celles que leur écran pose à la racine", () => {
    for (const { chemin, texte } of feuilles) {
      if (chemin in RIEN_NE_PEINT_APRES) continue;
      expect(monteUnModal(texte), `${chemin} pose une feuille sans Modal : ce qui la suit dans l'arbre peindra par-dessus`)
        .toBe(true);
    }
  });

  it("ne garde aucune dispense qui ne se justifie plus", () => {
    for (const [chemin, raison] of Object.entries(RIEN_NE_PEINT_APRES)) {
      const source = sources.find((s) => s.chemin === chemin);
      expect(source, `${chemin} est dispensée (« ${raison} ») mais n'existe plus`).toBeDefined();
      expect(emploieLaScene(source!.texte), `${chemin} est dispensée mais ne pose plus de feuille`).toBe(true);
      expect(monteUnModal(source!.texte), `${chemin} est dispensée mais emploie maintenant Modal : la dispense n'a plus d'objet`)
        .toBe(false);
    }
  });
});

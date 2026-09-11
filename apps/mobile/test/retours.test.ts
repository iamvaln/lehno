import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* UN ÉCRAN QUI PORTE UNE FLÈCHE LA PORTE DANS TOUS SES ÉTATS.
 *
 * Vingt-deux retours anticipés, sur douze écrans, rendaient leur panne ou leur
 * chargement SANS le moyen de revenir que porte leur état nominal. On y
 * arrivait par un bouton — « Chercher des idées » sur une liste sans occasion —
 * et il ne restait que « Cette demande n'est pas valide » et « Réessayer », qui
 * réessaie la même demande invalide.
 *
 * Le geste système — balayage iOS, retour Android — marche encore : ce n'est
 * pas un piège, c'est l'affordance qui disparaît au moment précis où l'on en a
 * le plus besoin. Sur un écran d'onglet il reste la barre, qui fait perdre sa
 * place ; sur un écran empilé hors des onglets, il ne reste rien à voir.
 *
 * La cause est toujours la même : la flèche est écrite dans la branche
 * nominale, et les branches anticipées sont écrites après, ailleurs, par
 * quelqu'un qui regarde la panne et pas la navigation. La hisser dans un
 * `const retour` — ou un `const entete` quand l'écran porte un `ScreenHeader` —
 * la rend impossible à oublier : on la rend, ou on ne la rend pas, mais on ne
 * la RÉÉCRIT plus.
 *
 * Le test lit la SOURCE plutôt que de rendre les écrans : `react-native` est
 * typé Flow, et Vitest ne le charge pas. C'est une garde grossière — elle
 * reconnaît un motif d'écriture — mais elle attrape exactement la faute qui
 * s'est produite vingt-deux fois.
 */

const RACINE = new URL("../app/", import.meta.url);

function ecrans(dossier: URL = RACINE, prefixe = ""): readonly string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.isDirectory()) {
      trouves.push(...ecrans(new URL(`${entree.name}/`, dossier), `${prefixe}${entree.name}/`));
    } else if (entree.name.endsWith(".tsx")) {
      trouves.push(`${prefixe}${entree.name}`);
    }
  }
  return trouves;
}

/* Un retour anticipé est un `if (…) { return ( … ); }` au premier niveau du
   composant. On ne retient que ceux qui rendent une PANNE ou un CHARGEMENT :
   ce sont les seuls où l'on est arrivé quelque part et où l'on veut repartir.
   Un état vide, lui, est un état nominal — il a sa propre flèche. */
const ANTICIPE = /\n {2}if \([^)]*\) \{\n {4}return \(\n((?:.*\n){0,30}?) {4}\);\n {2}\}\n/g;
const PANNE = /maintReessayer|LoadingState/;
const RETOUR = /\{retour\}|\{entete\}|<ScreenHeader|accessibilityLabel=\{t\.retour\}/;

export function brancheSansRetour(source: string): readonly number[] {
  // L'écran n'a pas de flèche du tout : il n'y a rien à perdre.
  if (!source.includes("routeur.back()")) return [];
  const fautes: number[] = [];
  for (const m of source.matchAll(ANTICIPE)) {
    const branche = m[1] ?? "";
    if (!PANNE.test(branche)) continue;
    if (RETOUR.test(branche)) continue;
    /* `m.index` tombe sur le saut de ligne QUI PRÉCÈDE le `if` : compter les
       lignes avant lui donne celle d'au-dessus. Le `+ 1` remet le doigt sur le
       `if` lui-même, qui est ce qu'on veut lire dans le message d'échec. */
    fautes.push(source.slice(0, m.index).split("\n").length + 1);
  }
  return fautes;
}

describe("la flèche vit dans tous les états", () => {
  for (const ecran of ecrans()) {
    it(`app/${ecran}`, () => {
      expect(brancheSansRetour(readFileSync(new URL(ecran, RACINE), "utf8"))).toEqual([]);
    });
  }

  /* LES SONDES. Une garde qui lit la source doit prouver qu'elle mord — celle
     des surcouches est passée verte sur trois écrans fautifs avant qu'on ne
     s'en aperçoive, parce qu'elle lisait ligne à ligne. */
  it("mord sur une panne qui perd la flèche", () => {
    const faute = [
      "const x = 1;",
      "  if (echec && !occasion) {",
      "    return (",
      "      <View>",
      "        <Banner intent=\"error\">{echec}</Banner>",
      "        <Button onPress={charge}>{t.maintReessayer}</Button>",
      "      </View>",
      "    );",
      "  }",
      "  routeur.back();",
    ].join("\n");
    expect(brancheSansRetour(faute)).toEqual([2]);
  });

  it("laisse passer une panne qui rend la flèche hissée", () => {
    const juste = [
      "const x = 1;",
      "  if (echec) {",
      "    return (",
      "      <View>",
      "        {retour}",
      "        <Button onPress={charge}>{t.maintReessayer}</Button>",
      "      </View>",
      "    );",
      "  }",
      "  routeur.back();",
    ].join("\n");
    expect(brancheSansRetour(juste)).toEqual([]);
  });

  /* Un écran sans flèche du tout — une racine d'onglet — n'a rien à perdre :
     l'exiger le forcerait à en dessiner une qui ne mène nulle part. */
  it("ne réclame rien d'un écran qui n'a pas de flèche", () => {
    const onglet = [
      "  if (!liste) {",
      "    return (",
      "      <View>",
      "        <LoadingState title={t.chargement} />",
      "      </View>",
      "    );",
      "  }",
    ].join("\n");
    expect(brancheSansRetour(onglet)).toEqual([]);
  });

  /* Un état VIDE n'est pas une panne : c'est le contenu nominal de l'écran,
     et il rend l'en-tête comme le reste. L'inclure ferait tomber la garde sur
     des branches qui n'ont jamais eu le défaut. */
  it("ne compte pas un état vide", () => {
    const vide = [
      "const x = 1;",
      "  if (!liste.length) {",
      "    return (",
      "      <View>",
      "        <EmptyState title={t.videListesTitre} />",
      "      </View>",
      "    );",
      "  }",
      "  routeur.back();",
    ].join("\n");
    expect(brancheSansRetour(vide)).toEqual([]);
  });
});

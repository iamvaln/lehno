import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* UN ÉCRAN QUI DIT « MES PROCHES » ÉCARTE LA FICHE DE SOI.
 *
 * `/me/persons` la rend parmi les autres — vérifié au serveur le 11 septembre.
 * Un écran qui lit la liste sans la filtrer met le titulaire dans son propre
 * carnet, et rien ne tombe : la liste est simplement plus longue d'un.
 *
 * La table est ÉCRITE À LA MAIN, et c'est le but : un écran qui se met à lire
 * le carnet doit être inscrit ici, donc DÉCIDÉ. Une détection automatique le
 * laisserait passer en silence — précisément le cas qu'on veut rendre
 * impossible.
 */
const ECRANS: Readonly<Record<string, "sansSoi" | "soiDabord">> = {
  "(app)/proches/index": "sansSoi",
  "(app)/proches/recherche": "sansSoi",
  "note": "sansSoi",
  /* Poser une date VISE quelqu'un, et ce quelqu'un peut être soi — c'est même
     le seul endroit où une date à soi se pose. */
  "evenement": "soiDabord",
};

/* ECRANS NE FERME LA GARDE QU'À MOITIÉ : elle sait quoi faire des écrans
 * qu'on y a mis, mais un écran neuf qui lirait `/me/persons` sans y figurer
 * ne ferait rien tomber — la faute silencieuse que cette garde existe pour
 * interdire, revenue par un autre chemin. DISPENSES ferme l'autre moitié :
 * tout écran qui lit la liste sans devoir la filtrer doit s'y trouver, AVEC
 * la raison pour laquelle `sansSoi`/`soiDabord` y serait faux — la raison
 * est le produit de cette table, pas la ligne qui la déclenche.
 */
const DISPENSES: Readonly<Record<string, string>> = {
  /* Bâtit une table id → displayName pour nommer l'auteur d'une contribution.
     En écarter soi serait un défaut, pas une garde : une contribution qu'on
     s'adresse à soi-même perdrait son nom dans cette table-là. */
  "(app)/valider": "nomme l'auteur d'une contribution, y compris quand c'est soi",
  /* Cherche délibérément `isSelf` pour retrouver SA PROPRE fiche et lister
     ses propres échéances — le seul usage du carnet ici. `sansSoi` la
     retirerait avant qu'on ait pu la trouver. */
  "(app)/listes": "cherche isSelf pour retrouver sa propre fiche, sansSoi la retirerait avant",
  /* `POST /me/persons` CRÉE un proche ; la réponse n'est même pas parsée en
     liste. Le balayage plus bas ne distingue pas lecture et écriture — sans
     cette entrée, une création (chemin sans identifiant, donc identique en
     texte à une lecture) ferait tomber la garde sur un écran qui ne lit
     jamais rien. */
  "(app)/proches/identite": "POST crée un proche, ne lit jamais la liste",
};

const source = (nom: string): string =>
  readFileSync(new URL(`../app/${nom}.tsx`, import.meta.url), "utf8");

/* Le prédicat est nommé et partagé plutôt qu'inline dans chaque `it` : c'est
   ce qui rend la sonde plus bas capable d'éprouver la garde elle-même, et pas
   sa propre paraphrase. Une sonde qui vérifierait une autre expression que
   celle de la boucle passerait au vert sans avoir rien mordu. */
const emploie = (source: string, attendu: "sansSoi" | "soiDabord"): boolean =>
  source.includes(`${attendu}(`);

describe("le carnet et la fiche de soi", () => {
  for (const [ecran, attendu] of Object.entries(ECRANS)) {
    it(`app/${ecran}.tsx emploie ${attendu}`, () => {
      expect(emploie(source(ecran), attendu)).toBe(true);
    });
  }

  /* LA SONDE. Une garde qui lit la source doit prouver qu'elle mord — sur une
     ligne fautive ET pas sur une ligne correcte. Le prédicat éprouvé ici est
     EXACTEMENT celui que la boucle ci-dessus emploie : une sonde qui en
     recopierait la logique à côté n'éprouverait que sa propre copie. */
  it("emploie() distingue l'écran qui filtre de celui qui ne filtre pas", () => {
    const faute = "setCarnet(personListSchema.parse(brut).persons);";
    const juste = "setCarnet(sansSoi(personListSchema.parse(brut).persons));";
    expect(emploie(faute, "sansSoi")).toBe(false);
    expect(emploie(juste, "sansSoi")).toBe(true);
  });
});

/* AUCUN ÉCRAN QUI ÉCRIT LE CHEMIN EN CLAIR N'ÉCHAPPE À LA TABLE.
 *
 * `ECRANS` et `DISPENSES` sont écrites à la main, et c'est voulu pour toutes
 * les deux — mais une table à la main ne proteste que sur ce qu'elle connaît
 * déjà. Elle est MUETTE sur un écran qui apparaît demain et lit `/me/persons`
 * sans qu'on l'y ait inscrit : rien ne tombe, et c'est exactement la faute
 * que ce plan corrige, revenue par un autre chemin que celui déjà fermé plus
 * haut. Ce test balaie donc les SOURCES de `app/**` pour trouver qui écrit le
 * chemin, et exige que chaque trouvaille figure dans l'une des deux tables.
 *
 * CE QU'IL LAISSE PASSER, et qu'il faut savoir : un écran qui obtiendrait la
 * liste d'un auxiliaire de `lib/` — sans jamais écrire `/me/persons` chez lui —
 * ne serait pas vu. Étendre le balayage à `lib/` coûterait ses propres
 * dispenses, parce que `persons` y paraît dans des commentaires, et cela pour
 * un cas qui n'existe pas encore. Le jour où un tel auxiliaire naîtra, c'est
 * lui qu'il faudra inscrire.
 */
const RACINE_APP = new URL("../app/", import.meta.url);

/** Tous les `.tsx` sous `app/`, groupes `(…)` compris — chemin relatif à
    `app/`, SANS extension : la forme des clés de `ECRANS` et `DISPENSES`. */
function tousLesEcrans(dossier: URL = RACINE_APP, prefixe = ""): readonly string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.isDirectory()) {
      trouves.push(...tousLesEcrans(new URL(`${entree.name}/`, dossier), `${prefixe}${entree.name}/`));
    } else if (entree.name.endsWith(".tsx")) {
      trouves.push(`${prefixe}${entree.name.slice(0, -".tsx".length)}`);
    }
  }
  return trouves;
}

/* Sans identifiant derrière : `/me/persons/${id}` vise UNE fiche précise, pas
   la liste, et ne peut jamais y remettre soi. Le `(?!\/)` écarte ce cas —
   mais il laisse passer une création sans identifiant (`POST /me/persons`),
   qui a la même forme en texte : c'est pour elle que `DISPENSES` existe. */
const LIT_LA_LISTE = /\/me\/persons(?!\/)/;

describe("aucun lecteur de /me/persons n'échappe à la table", () => {
  it("chaque écran qui la mentionne figure dans ECRANS ou DISPENSES", () => {
    const connus = new Set([...Object.keys(ECRANS), ...Object.keys(DISPENSES)]);
    const oublies = tousLesEcrans().filter(
      (ecran) => LIT_LA_LISTE.test(source(ecran)) && !connus.has(ecran),
    );
    expect(oublies).toEqual([]);
  });
});

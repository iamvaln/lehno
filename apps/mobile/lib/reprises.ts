import { estActive, type GenerationKind, type GenerationResult, type Occurrence } from "@lehno/contracts";
import { decaleDeMois } from "./dates.js";

/* Reprises en cours — §3.16.
 *
 * L'écran tient une promesse : rien ne se perd. Ce qu'on a lancé et laissé en
 * plan se retrouve ici, et se reprend d'un geste.
 *
 * Il se lit DU PLUS URGENT AU MOINS URGENT — l'occasion la plus proche
 * d'abord —, et non par date de création : ce qui presse n'est pas ce qu'on a
 * commencé en dernier. Une occasion passée ne disparaît pas pour autant, le
 * travail existe encore ; la mention le signale sans le condamner.
 *
 * Tout ce qui se décide vit ici, hors de React : le tri, le filtre des
 * drapeaux, la jointure avec l'échéance visée et la coupe de l'extrait. Le
 * `.tsx` ne fait que dessiner ce que ce module rend.
 */

/* ── Les trois natures ────────────────────────────────────────────────────── */

/* Les clés du dictionnaire, écrites en toutes lettres plutôt que composées :
   `t["reprise" + genre]` laisserait un libellé manquant filer jusqu'à l'écran,
   où il s'afficherait en « undefined ». Ici l'erreur ne compile pas. */
export type CleDeNature = "repriseBrouillon" | "repriseIdees" | "reprisePortrait";

export interface Nature {
  readonly libelle: CleDeNature;
  readonly icone: string;
  /* LES TROIS NATURES SONT TROIS DRAPEAUX, pas un interrupteur. Au lancement
     seul le message est allumé, et c'est le cas NOMINAL : une liste qui
     supposerait les trois ouvertes proposerait de reprendre des portraits que
     le produit ne sait pas encore produire. */
  readonly drapeau: string;
}

/* Une TABLE TOTALE, pas un `switch` : `Record<GenerationKind, …>` refuse de
   compiler tant qu'une nature ajoutée au contrat n'a ni libellé, ni icône, ni
   drapeau. Une quatrième nature livrée sans son drapeau paraîtrait sinon quel
   que soit l'état du registre — l'inverse exact de ce que §3.16 promet. */
export const NATURES: Record<GenerationKind, Nature> = {
  wish_message: { libelle: "repriseBrouillon", icone: "pencil", drapeau: "generation.message" },
  gift_ideas: { libelle: "repriseIdees", icone: "gift", drapeau: "generation.ideas" },
  portrait: { libelle: "reprisePortrait", icone: "sparkles", drapeau: "generation.portrait" },
};

/* ── Ce que l'écran dessine ───────────────────────────────────────────────── */

export interface Reprise {
  /* Celui de l'EXÉCUTION, jamais celui du résultat : c'est l'exécution qu'on
     reprend, et une exécution en cours n'a pas encore de résultat. */
  id: string;
  kind: GenerationKind;
  libelle: CleDeNature;
  icone: string;
  /* Pour QUI, et dans combien de jours.
   *
   * Nuls quand on ne sait pas, et c'est fréquent : le contrat ne dit ce que
   * vise une exécution qu'à travers son résultat (`message.occurrenceId`), et
   * ce résultat est « nul tant que l'exécution n'a pas abouti ». Une reprise
   * `running` n'a donc ni nom ni décompte — la carte se replie plutôt que
   * d'inventer une cible. */
  qui: string | null;
  jours: number | null;
  extrait: string | null;
  /* Le serveur produit encore. La carte ne montre alors pas de décompte : il
     n'y a rien à décompter tant que la cible est inconnue. */
  enCours: boolean;
}

/* ── La fenêtre d'échéances qu'il faut pour nommer les cibles ─────────────── */

/* DOUZE MOIS EN ARRIÈRE, contre un seul pour §3.14.
 *
 * Les deux vues ne cherchent pas la même chose. Dates montre le mois écoulé —
 * on revient voir ce qu'on a manqué. §3.16 doit au contraire nommer la cible
 * d'un brouillon qui peut dormir depuis un an : « La date est passée » sans
 * dire de qui il s'agit ne se reprend pas, et c'est exactement le travail que
 * l'écran promet de ne pas perdre.
 */
export const MOIS_EN_ARRIERE = 12;
export const MOIS_EN_AVANT = 12;

export function fenetreDesReprises(aujourdhui: string): { from: string; to: string } {
  return {
    from: decaleDeMois(aujourdhui, -MOIS_EN_ARRIERE),
    to: decaleDeMois(aujourdhui, MOIS_EN_AVANT),
  };
}

/* ── L'extrait ────────────────────────────────────────────────────────────── */

/* Ce que la carte montre du texte produit. Le brouillon fait plusieurs
   paragraphes ; la carte en tient une ligne ou deux. */
export const LONGUEUR_DE_LEXTRAIT = 90;

/* La coupe se fait SUR UN MOT ENTIER, et le repli des blancs vient d'abord :
   un message porte des retours à la ligne, et les laisser passer ferait une
   carte haute de six lignes au milieu d'une liste de cartes basses. Couper au
   caractère près, lui, donnerait « le moulin à ca… » — on lit le défaut avant
   de lire la phrase. */
export function extraitDe(texte: string, max = LONGUEUR_DE_LEXTRAIT): string | null {
  const plat = texte.replace(/\s+/gu, " ").trim();
  if (plat === "") return null;
  if (plat.length <= max) return plat;
  const coupe = plat.slice(0, max);
  const dernierEspace = coupe.lastIndexOf(" ");
  const mots = dernierEspace > 0 ? coupe.slice(0, dernierEspace) : coupe;
  // La ponctuation qui traînait avant l'élision ferait « le moulin,… ».
  return `${mots.replace(/[\s,;:.…]+$/u, "")}…`;
}

/* ── L'ordre ──────────────────────────────────────────────────────────────── */

const A_VENIR = 0;
const SANS_DATE = 1;
const DEPASSEE = 2;

function groupe(r: Reprise): number {
  if (r.jours === null) return SANS_DATE;
  return r.jours < 0 ? DEPASSEE : A_VENIR;
}

/* Du plus urgent au moins urgent, en trois groupes.
 *
 * Les DÉPASSÉES FERMENT LA LISTE : le travail existe encore, mais il ne presse
 * plus, et le laisser en tête repousserait sous le pli ce qui tombe demain.
 *
 * Entre elles, la PLUS RÉCENTE D'ABORD — l'inverse de ce que fait le kit, qui
 * les trie comme les autres. Il n'avait qu'une date passée sur sa planche, donc
 * l'ordre ne s'y voyait pas ; à trois, son tri croissant enterre au fond celle
 * d'avant-hier, la seule qu'on puisse encore rattraper, sous celle d'il y a
 * neuf mois.
 *
 * Les SANS DATE au milieu : une exécution en cours n'a pas encore de cible
 * (voir `Reprise.qui`). On ne peut pas la classer par urgence, et la mettre
 * après les dépassées la ferait passer pour close alors qu'elle travaille.
 *
 * Le tri est STABLE, et on s'en sert : dans un groupe sans date, l'ordre reçu
 * du serveur — le plus récent d'abord — est déjà le bon.
 */
export function ordonne(reprises: readonly Reprise[]): Reprise[] {
  return [...reprises].sort((a, b) => {
    const ga = groupe(a);
    const gb = groupe(b);
    if (ga !== gb) return ga - gb;
    if (a.jours === null || b.jours === null) return 0;
    return ga === DEPASSEE ? b.jours - a.jours : a.jours - b.jours;
  });
}

/* ── La liste ─────────────────────────────────────────────────────────────── */

/* Ce que l'écran affiche, des deux appels et de la liste des drapeaux.
 *
 * LE DRAPEAU GOUVERNE CE QU'ON PROPOSE. Le dépôt a déjà tranché en faveur de
 * « ne masquez pas l'existant » (voir `dates.ts`), et la règle ne s'applique
 * pas ici — non par exception, mais parce que ce n'est pas le même objet. Une
 * date est un CONTENU : la masquer efface la seule vue qu'on en a. Une reprise
 * est une PORTE : sa carte n'existe que pour son bouton « Reprendre », et ce
 * bouton mène à §3.7 ou §3.22, que `ecranEteint` retire de la navigation quand
 * la nature s'éteint. Garder la carte donnerait le renvoi vers un écran absent
 * que le handoff interdit — et le serveur refuserait de toute façon.
 *
 * Ce qui est déjà produit, lui, ne se perd pas pour autant : un message payé
 * reste lisible et corrigeable par `/me/messages/{id}`, qui n'est délibérément
 * PAS sous `generation.message`. §3.16 retire un raccourci, pas un contenu.
 *
 * `failed` ne figure pas : le crédit a été rendu, rien n'a été produit, et
 * « Reprendre » n'y reprendrait rien. L'écran montre ce que le serveur produit
 * et ce qu'il a produit.
 */
export function composeLesReprises(
  generations: readonly GenerationResult[],
  echeances: readonly Occurrence[],
  actives: readonly string[],
): Reprise[] {
  const parEcheance = new Map(echeances.map((e) => [e.id, e]));
  const retenues: Reprise[] = [];

  for (const { generation, message } of generations) {
    if (generation.status === "failed") continue;
    const nature = NATURES[generation.kind];
    if (!estActive(actives, nature.drapeau)) continue;

    /* La jointure peut manquer sans que ce soit un défaut : l'échéance visée
       peut tomber hors de la fenêtre demandée, ou au-delà du plafond de la
       page. Mieux vaut une carte sans nom qu'un nom emprunté à une autre. */
    const echeance = message === null ? undefined : parEcheance.get(message.occurrenceId);

    retenues.push({
      id: generation.id,
      kind: generation.kind,
      libelle: nature.libelle,
      icone: nature.icone,
      qui: echeance?.personDisplayName ?? null,
      jours: echeance?.daysUntil ?? null,
      extrait: message === null ? null : extraitDe(message.content),
      enCours: generation.status === "running",
    });
  }

  return ordonne(retenues);
}

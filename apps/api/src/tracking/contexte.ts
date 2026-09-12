import { AsyncLocalStorage } from "node:async_hooks";
import {
  ENTETES_CLIENT, ENTETES_MESURE, SURFACES, TYPES_CLIENT, ENVS_CLIENT,
  type Surface, type TypeClient, type EnvClient,
} from "@lehno/contracts";

/* Le contexte client d'une requête, disponible sans le faire voyager.
 *
 * Sans ce stockage, chaque service devrait recevoir la surface, la version et
 * la session en paramètre, et les passer à son tour. Une signature de plus sur
 * chaque méthode, pour une donnée qui n'intéresse que la mesure — et le
 * premier appelant qui oublie de la transmettre creuse un trou dans la série
 * sans que rien ne rougisse. */
export type ContexteMesure = {
  surface: Surface | null;
  appVersion: string | null;
  language: string | null;
  theme: string | null;
  sessionId: string | null;
  correlationId: string | null;
  /* ── CE QUE LE BUILD ANNONCE DE LUI-MÊME ───────────────────────────────────
   *
   * Le contexte portait déjà la surface et la version pour la mesure. Il porte
   * maintenant de quoi répondre à « qui appelait, et dans quelle version » sur
   * n'importe quelle ligne qu'on relira.
   *
   * ILS VIVENT ICI ET NON DANS UN SECOND STOCKAGE. Poser un contexte à côté
   * pour la traçabilité aurait donné deux vérités sur la même requête, et le
   * premier service qui lit la mauvaise creuse un trou sans que rien ne
   * rougisse — c'est exactement ce que le commentaire du haut dit déjà. */
  clientId: string | null;
  clientType: TypeClient | null;
  /* L'identité d'un build, et ce sur quoi « plus ancien que » se décide.
     Nul quand l'en-tête manque ou n'est pas un entier : un appel qu'on ne peut
     pas comparer est traité comme inconnu, donc invité à se mettre à jour. */
  appBuild: number | null;
  /** `ios` ou `android`, découpé de `x-app-os`. */
  osName: string | null;
  /** `17.4`, ou le niveau d'API Android. */
  osVersion: string | null;
  env: EnvClient | null;
  /* CE QUE LE SERVEUR A CONCLU de ce qui lui a été annoncé — `reconnu`,
     `inconnu`, `cle_fausse`… Distinct de `clientId`, qui est ce que le client a
     DIT être : en phase 1 on ne refuse rien, et c'est justement l'écart entre
     les deux qu'on vient mesurer avant d'allumer la garde. */
  clientVerdict: string | null;
  /* L'ENVIRONNEMENT DU CLIENT RECONNU — celui de la BASE, à ne pas confondre
     avec `env`, qui est ce que l'en-tête déclare.
     Les deux existent exprès : leur ÉCART dit qu'un build de recette pointe la
     production, et c'est précisément l'incident qu'on veut voir. Mais seule
     celle-ci décide de quoi que ce soit — l'autre est déclarative. */
  clientEnv: string | null;
};

const STOCKAGE = new AsyncLocalStorage<ContexteMesure>();

export function dansLeContexte<T>(contexte: ContexteMesure, suite: () => T): T {
  return STOCKAGE.run(contexte, suite);
}

// Vide hors requête — un traitement programmé, un test unitaire. Rendre des
// nulls plutôt que de lever : la mesure ne fait jamais échouer ce qu'elle
// mesure.
export function contexteCourant(): ContexteMesure {
  return STOCKAGE.getStore() ?? {
    surface: null, appVersion: null, language: null,
    theme: null, sessionId: null, correlationId: null,
    clientId: null, clientType: null, appBuild: null,
    osName: null, osVersion: null, env: null,
    clientVerdict: null, clientEnv: null,
  };
}

/* Un en-tête est écrit par le client : il peut être répété, démesuré, ou
 * porter un retour à la ligne pour casser une ligne de journal. On le borne et
 * on le nettoie AVANT qu'il n'aille où que ce soit — même règle que
 * CorrelationMiddleware, pour la même raison. */
const LONGUEUR_MAX = 64;

function propre(valeur: unknown): string | null {
  return nettoyer(valeur, /[^\w.\-+]/g);
}

/* MÊME NETTOYAGE, MAIS LE DEUX-POINTS SURVIT. `x-app-os` vaut `ios:17.4`, et le
   jeu de caractères ci-dessus mange le séparateur — le découpage ne verrait
   alors jamais qu'un seul champ. Une fonction à part plutôt qu'un jeu élargi
   pour tous : élargir aurait laissé passer le deux-points dans la langue, le
   thème et la session, où il n'a rien à faire. */
function propreAvecDeuxPoints(valeur: unknown): string | null {
  return nettoyer(valeur, /[^\w.\-+:]/g);
}

function nettoyer(valeur: unknown, interdits: RegExp): string | null {
  const brut = Array.isArray(valeur) ? valeur[0] : valeur;
  if (typeof brut !== "string") return null;
  const net = brut.replace(interdits, "").slice(0, LONGUEUR_MAX);
  return net.length > 0 ? net : null;
}

export function lireEntetes(
  entetes: Record<string, unknown>,
  correlationId: string | null,
): ContexteMesure {
  const surfaceBrute = propre(entetes[ENTETES_MESURE.surface]);
  return {
    // Une surface inconnue vaut « pas de surface » : mieux vaut une propriété
    // vide qu'une valeur inventée qui polluerait une segmentation.
    surface: (SURFACES as readonly string[]).includes(surfaceBrute ?? "")
      ? (surfaceBrute as Surface)
      : null,
    /* UN SEUL EN-TÊTE DE VERSION, et il vient de `ENTETES_CLIENT`. Il s'appelait
       `x-lehno-app-version` et vivait dans `ENTETES_MESURE` ; en garder deux —
       un pour la mesure, un pour la traçabilité — aurait fait deux listes à
       tenir d'accord. */
    appVersion: propre(entetes[ENTETES_CLIENT.appVersion]),
    language: propre(entetes[ENTETES_MESURE.language]),
    theme: propre(entetes[ENTETES_MESURE.theme]),
    sessionId: propre(entetes[ENTETES_MESURE.sessionId]),
    correlationId,
    clientId: propre(entetes[ENTETES_CLIENT.clientId]),
    appBuild: entier(propre(entetes[ENTETES_CLIENT.appBuild])),
    /* Une valeur hors liste vaut « inconnu » et non la valeur brute : la ranger
       telle quelle mettrait dans la colonne ce que le client a bien voulu y
       écrire, et une colonne de journal n'est pas un champ libre. */
    clientType: dansLaListe(TYPES_CLIENT, propre(entetes[ENTETES_CLIENT.clientType])),
    env: dansLaListe(ENVS_CLIENT, propre(entetes[ENTETES_CLIENT.env])),
    ...decouperLOs(propreAvecDeuxPoints(entetes[ENTETES_CLIENT.os])),
    // Le middleware les remplit après avoir résolu le client ; `lireEntetes` ne
    // lit que ce qui arrive, elle ne juge pas.
    clientVerdict: null,
    clientEnv: null,
  };
}

/* Rendre la valeur seulement si la liste la connaît. Même raisonnement que la
   surface juste au-dessus : mieux vaut une propriété vide qu'une valeur
   inventée qui polluerait une segmentation. */
/* UN ENTIER, OU RIEN. Un build « 4.1.2 », « latest » ou vide ne se compare pas ;
   le prendre pour zéro le rendrait plus ancien que tout et déclencherait une
   mise à jour forcée sur un client parfaitement à jour. */
function entier(valeur: string | null): number | null {
  if (valeur === null || !/^\d{1,9}$/.test(valeur)) return null;
  return Number(valeur);
}

function dansLaListe<T extends string>(liste: readonly T[], valeur: string | null): T | null {
  /* LA CASSE NE COMPTE PAS, et ce n'est pas de la complaisance.
   *
   * Les briefs des clients annonçaient `MOBILE_IOS` — repris de monjeton, qui
   * stocke ses types en majuscules —, là où ce contrat compare à `mobile_ios`.
   * Un build qui aurait suivi le brief serait passé en phase 1, où rien ne
   * refuse, et se serait fait mettre dehors LE JOUR OÙ L'ON ALLUME LA PHASE 2 :
   * invisible pendant des semaines, catastrophique d'un coup.
   *
   * On normalise ici plutôt que de compter sur trois équipes pour accorder une
   * casse. Les briefs sont corrigés aussi — mais un seul des deux correctifs
   * aurait laissé le piège ouvert pour le prochain client. */
  const net = valeur?.toLowerCase() ?? "";
  return (liste as readonly string[]).includes(net) ? (net as T) : null;
}

/* `ios:17.4` DEVIENT DEUX CHAMPS, ET LE DÉCOUPAGE SE FAIT ICI, UNE FOIS.
 *
 * Laisser la chaîne composée traverser obligerait chaque lecture à la découper
 * — et celle qui oublierait compterait « ios:17.4 » et « ios:17.5 » comme deux
 * systèmes différents. Un point de découpe, comme il n'y a qu'un point de
 * lecture d'en-têtes.
 *
 * Une valeur sans deux-points donne un nom sans version plutôt que rien : un
 * client qui envoie « web » dit quelque chose d'utile. */
function decouperLOs(brut: string | null): { osName: string | null; osVersion: string | null } {
  if (brut === null) return { osName: null, osVersion: null };
  const coupe = brut.indexOf(".");
  const separateur = brut.indexOf(":");
  if (separateur === -1 || (coupe !== -1 && coupe < separateur))
    return { osName: brut, osVersion: null };
  const nom = brut.slice(0, separateur);
  const version = brut.slice(separateur + 1);
  return { osName: nom.length > 0 ? nom : null, osVersion: version.length > 0 ? version : null };
}

import Constants from "expo-constants";
import { NativeModules } from "react-native";
import { errorEnvelopeSchema, type ErrorCode, type ErrorEnvelope, type Session } from "@lehno/contracts";
import { adresseDeLApi } from "./adresse-api.js";
import { doitRenouveler, sortDeLaSession } from "./session.js";
import { effaceLesJetons, litLesJetons, poseLesJetons } from "./jetons.js";
import { unSeulALaFois } from "./verrou.js";
import { estHorsConnexion } from "./reseau.js";
import { estGarde } from "./cache.js";
import { litLeCache, poseAuCache } from "./coffre.js";
import { estDifferable } from "./file.js";
import { litLaFile, poseLaFile } from "./fileStockee.js";

/* Le seul endroit qui parle au serveur.
 *
 * Il porte le jeton, renouvelle en silence quand il a expiré, et rejoue l'appel
 * une fois — une seule. Un second échec après renouvellement n'est plus une
 * question de session : insister ferait une boucle.
 */

/* En développement, l'API tourne sur la machine qui sert le bundle : Expo en
   donne l'adresse, et c'est le seul moyen qui vaille pour un émulateur, un
   simulateur et un téléphone du même réseau. En production, EXPO_PUBLIC_API_URL
   est obligatoire — sans elle, mieux vaut échouer que s'appeler soi-même. */
/* D'où vient l'hôte, par ordre de fiabilité. `scriptURL` est l'adresse d'où le
   bundle a été chargé : elle existe dans une application native comme sous Expo
   Go. `hostUri` ne vaut que sous Expo Go — le garder en second couvre les cas
   où le premier manquerait.

   La résolution est PARESSEUSE, et c'est délibéré : lever à l'import tuait
   l'application avant qu'un seul écran s'affiche, et l'erreur ne se voyait que
   dans un journal. Un défaut de réglage doit se lire à l'écran, comme les
   autres — le bandeau d'erreur est déjà là pour ça. */
function adresseCourante(): string | null {
  const source = (NativeModules["SourceCode"] as { scriptURL?: string } | undefined)?.scriptURL
    ?? Constants.expoConfig?.hostUri;
  return adresseDeLApi(process.env["EXPO_PUBLIC_API_URL"], source);
}

/* Une couture, et une seule : tout appel qui échoue passe par ici avant de
   remonter à l'appelant. C'est ainsi qu'un arrêt commencé au milieu d'une
   séance se découvre — sans que chaque écran ait à y penser, ce qu'aucun
   écran ne ferait de façon fiable. Il suffirait d'un oubli pour qu'une
   surface reste seule devant un mur.

   Plusieurs abonnés : l'arrêt et les drapeaux lisent les mêmes échecs pour
   des raisons différentes. Un abonné unique ferait que le second inscrit
   déloge le premier, en silence. */
type Temoin = (erreur: unknown) => void;
const temoins = new Set<Temoin>();

export function surEchec(observateur: Temoin): () => void {
  temoins.add(observateur);
  return () => { temoins.delete(observateur); };
}

function signaleLEchec(erreur: unknown): never {
  for (const temoin of temoins) temoin(erreur);
  throw erreur;
}

export class SansAdresseDApi extends Error {
  constructor() {
    super("Aucune adresse d'API : posez EXPO_PUBLIC_API_URL, ou lancez depuis le serveur de développement.");
    this.name = "SansAdresseDApi";
  }
}

/* Ce que le client ne peut pas deviner seul : la surface visée était-elle
   gouvernée par un drapeau. Sur une surface gouvernée, un `404 not_found`
   ne dit pas « cette chose n'existe pas » mais « cette fonctionnalité vous
   a été retirée depuis votre dernière lecture ». Sur le socle, c'est
   l'inverse — un proche supprimé rend le même code, et relire les drapeaux
   à chaque fois ferait un rappel serveur pour rien.

   D'où le défaut : NON gouvernée. Le socle est la majorité des appels, et
   les rares surfaces sous drapeau le déclarent. */
export interface OptionsDAppel extends RequestInit {
  gouvernee?: boolean;
  /* CE QUI SORT DE LA FILE N'Y RENTRE PAS.
   *
   * Sans ce drapeau, un réseau qui retombe PENDANT le rejeu ferait remettre en
   * file l'action qu'on était en train d'en sortir — elle s'y trouverait deux
   * fois, et partirait deux fois au retour suivant. C'est exactement la
   * duplication que ce module existe pour empêcher, réintroduite par la porte
   * de derrière.
   *
   * Un rejeu qui rencontre l'absence de réseau échoue simplement : l'action est
   * toujours en tête de file, elle n'a pas bougé, et le prochain retour la
   * reprendra. */
  rejeu?: boolean;
}

export class ErreurDApi extends Error {
  constructor(
    readonly statut: number,
    readonly enveloppe: ErrorEnvelope | null,
    readonly gouvernee = false,
  ) {
    super(enveloppe?.message ?? `HTTP ${statut}`);
    this.name = "ErreurDApi";
  }

  get code(): ErrorCode | null {
    return this.enveloppe?.code ?? null;
  }
}

async function litLEnveloppe(reponse: Response): Promise<ErrorEnvelope | null> {
  try {
    const analyse = errorEnvelopeSchema.safeParse(await reponse.json());
    return analyse.success ? analyse.data : null;
  } catch {
    // Une réponse vide ou du HTML — une passerelle en panne, par exemple.
    return null;
  }
}

async function envoie(chemin: string, options: RequestInit, jeton?: string): Promise<Response> {
  const base = adresseCourante();
  if (!base) throw new SansAdresseDApi();
  return fetch(`${base}/v1${chemin}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
      ...options.headers,
    },
  });
}

/* Appelle une surface publique — pas de jeton, pas de renouvellement. */
export async function appelPublic<T>(chemin: string, options: OptionsDAppel = {}): Promise<T> {
  const { gouvernee = false, ...requete } = options;
  const reponse = await envoie(chemin, requete);
  if (!reponse.ok) signaleLEchec(new ErreurDApi(reponse.status, await litLEnveloppe(reponse), gouvernee));
  return reponse.status === 204 ? (undefined as T) : ((await reponse.json()) as T);
}

/* LE TEXTE D'UNE SURFACE PUBLIQUE, et non du JSON.
 *
 * Les documents légaux sont servis en `text/markdown` : les passer par
 * `appelPublic` les ferait analyser comme du JSON et tomber sur le premier
 * caractère. Ils sont PUBLICS à dessein — l'écran de connexion doit les ouvrir
 * avant qu'aucune session n'existe, puisque c'est là qu'on les accepte.
 *
 * L'échec passe par le même chemin que les autres : un document manquant est un
 * 404 comme un autre, et l'écran doit pouvoir le dire.
 */
export async function texteDunePagePublique(chemin: string): Promise<string> {
  const reponse = await envoie(chemin, {});
  if (!reponse.ok) signaleLEchec(new ErreurDApi(reponse.status, await litLEnveloppe(reponse)));
  return reponse.text();
}

/* UN SEUL RENOUVELLEMENT À LA FOIS, partagé par tous ceux qui l'attendent.
 *
 * Le serveur fait TOURNER le jeton de rafraîchissement : chaque usage rend une
 * paire neuve et brûle l'ancienne. Deux appels lancés ensemble — la fiche d'un
 * proche en fait deux, la fiche et ses notes — expirent ensemble, et chacun
 * repartait avec le MÊME jeton. Le second passait alors pour un rejeu :
 * `refresh_reused`, et la session tombait pour de bon.
 *
 * Vu à l'écran : le carnet, qui n'appelle qu'une fois, se rechargeait très
 * bien ; la fiche échouait systématiquement passé un quart d'heure.
 *
 * D'où le verrou : le premier arrivé lance la demande, les autres attendent la
 * sienne et repartent avec la paire qu'elle a posée.
 *
 * Le jeton joué est celui que le trousseau porte au moment où la demande part,
 * pas celui qu'un appelant avait en main : les retardataires n'apportent que le
 * leur, déjà brûlé par le premier. */
const renouvelle = unSeulALaFois(async () => {
  const jetons = await litLesJetons();
  return jetons ? demandeUnRenouvellement(jetons.rafraichissement) : false;
});

async function demandeUnRenouvellement(rafraichissement: string): Promise<boolean> {
  const reponse = await envoie("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: rafraichissement }),
  });
  if (!reponse.ok) return false;
  await poseLesJetons((await reponse.json()) as Session);
  return true;
}

/* Appelle l'espace privé. Renouvelle une fois si le jeton a expiré, puis
   rejoue. Efface la session quand le serveur dit qu'elle n'a plus lieu d'être —
   rester connecté sur un compte suspendu donnerait une application qui échoue à
   chaque geste sans dire pourquoi. */
/* Hors connexion, et rien de gardé pour cette page. Ce n'est PAS une erreur du
   serveur — il n'a rien répondu, il n'a rien reçu. Une classe à part pour que
   l'écran puisse le distinguer d'une panne : la bannière du haut explique déjà
   pourquoi, et confondre les deux ferait afficher « le service a un problème »
   à quelqu'un qui est simplement dans un tunnel. */
export class SansReseau extends Error {
  constructor() {
    super("hors connexion");
    this.name = "SansReseau";
  }
}

/* L'action a été RETENUE, pas perdue. Une classe à part de `SansReseau` :
   l'écran doit pouvoir dire « c'est noté, ça partira » plutôt que « ça a
   échoué ». Confondre les deux ferait recommencer quelqu'un dont le geste est
   déjà en file — et il partirait deux fois au retour du réseau. */
export class MiseEnFile extends Error {
  constructor(public readonly enAttente: number) {
    super("action retenue jusqu'au retour du réseau");
    this.name = "MiseEnFile";
  }
}

/* Ce qui change quand la file bouge. Le bandeau lit ce compte : sans témoin, il
   afficherait « 2 actions » pendant qu'il y en a cinq, et la promesse
   perdrait sa valeur au moment où elle rassure. */
type TemoinDeFile = (enAttente: number) => void;
const temoinsDeFile = new Set<TemoinDeFile>();

export function surLaFile(observateur: TemoinDeFile): () => void {
  temoinsDeFile.add(observateur);
  return () => { temoinsDeFile.delete(observateur); };
}

function annonceLaFile(enAttente: number): void {
  for (const t of temoinsDeFile) t(enAttente);
}

export async function appel<T>(chemin: string, options: OptionsDAppel = {}): Promise<T> {
  const { gouvernee = false, rejeu = false, ...requete } = options;
  const methode = (requete.method ?? "GET").toUpperCase();

  /* LE REPLI, AVANT TOUT LE RESTE.
   *
   * Hors connexion, on ne part pas au réseau pour échouer : la requête ne peut
   * pas aboutir, et l'attendre ferait patienter devant un délai qu'on sait
   * inutile — le pire moment pour faire attendre est celui où l'on sait déjà.
   *
   * Ce chemin ne s'ouvre QUE hors connexion. En ligne, le cache n'est jamais
   * lu : c'est ce qui dispense de l'invalider, et donc ce qui rend ce cache
   * tenable du tout. Voir `cache.ts`. */
  if (estHorsConnexion()) {
    if (estGarde(chemin, methode)) {
      const garde = await litLeCache(chemin);
      if (garde !== null) return JSON.parse(garde) as T;
    }

    /* ON MET EN FILE ICI, ET NULLE PART AILLEURS — c'est le seul endroit où
       l'on sait que la requête N'EST PAS PARTIE. C'est toute la sûreté du
       dispositif : le serveur ne l'a pas vue, la rejouer ne peut rien
       dupliquer, et il n'a pas fallu lui ajouter une clé d'idempotence qu'il
       n'a que sur deux routes.

       Une écriture qui échoue APRÈS être partie ne passe jamais par ici : son
       issue est inconnue, le serveur l'a peut-être exécutée, et la rejouer
       créerait la deuxième note. */
    if (!rejeu && estDifferable(chemin, methode)) {
      const file = await litLaFile();
      const corps = typeof requete.body === "string" ? requete.body : null;
      const suite = [...file, {
        id: String(Date.now()) + ":" + String(file.length),
        chemin, methode, corps, poseeLe: new Date().toISOString(),
      }];
      await poseLaFile(suite);
      annonceLaFile(suite.length);
      throw new MiseEnFile(suite.length);
    }

    throw new SansReseau();
  }

  const jetons = await litLesJetons();
  // Pas de session : rien à signaler, ce n'est pas un échec du serveur.
  if (!jetons) throw new ErreurDApi(401, null);

  let reponse = await envoie(chemin, requete, jetons.acces);

  if (!reponse.ok) {
    const enveloppe = await litLEnveloppe(reponse);

    if (doitRenouveler(reponse.status, enveloppe?.code ?? null)) {
      if (!(await renouvelle())) {
        await effaceLesJetons();
        signaleLEchec(new ErreurDApi(401, enveloppe));
      }
      const neufs = await litLesJetons();
      reponse = await envoie(chemin, requete, neufs?.acces);
      if (!reponse.ok) signaleLEchec(new ErreurDApi(reponse.status, await litLEnveloppe(reponse), gouvernee));
    } else {
      if (sortDeLaSession(enveloppe?.code ?? null)) await effaceLesJetons();
      signaleLEchec(new ErreurDApi(reponse.status, enveloppe, gouvernee));
    }
  }

  if (reponse.status === 204) return undefined as T;

  /* On lit le TEXTE, pas le JSON déjà analysé : c'est le corps brut qu'on garde,
     pour pouvoir le repasser par le schéma à la relecture. Un corps gardé par
     une version précédente que le contrat ne décrit plus tombe alors au parsage
     et se jette, au lieu de remonter malformé jusqu'à l'écran. */
  const texte = await reponse.text();
  /* On garde APRÈS avoir servi, et sans attendre : une écriture au cache qui
     traîne ne doit pas retarder l'affichage de ce qu'on vient de recevoir. */
  if (estGarde(chemin, methode)) void poseAuCache(chemin, texte);
  return JSON.parse(texte) as T;
}

/* LE REJEU, au retour du réseau.
 *
 * UNE SEULE À LA FOIS, et dans l'ordre. Les envoyer en parallèle ferait
 * arriver une note avant la fiche qu'elle vise : le serveur refuserait, et la
 * note serait perdue pour une raison qui n'est pas la sienne.
 *
 * L'ÉCHEC ARRÊTE, IL NE SAUTE PAS. Voir `file.ts` : une file qui se vide en
 * perdant la moitié de ce qu'elle portait ne le dit à personne. Une file
 * bloquée, elle, se voit — le compte reste affiché sur le bandeau.
 *
 * ON NE REJOUE PAS DEUX FOIS EN MÊME TEMPS : `unSeulALaFois` garde l'entrée.
 * Le réseau qui vacille — il revient, retombe, revient — déclencherait sinon
 * deux rejeux concurrents sur la même file, et la même action partirait deux
 * fois. C'est exactement la duplication que tout ce module existe pour éviter.
 */
export const rejoueLaFile = unSeulALaFois(async (): Promise<void> => {
  if (estHorsConnexion()) return;

  let file = await litLaFile();
  while (file.length > 0) {
    const tete = file[0]!;
    try {
      await appel<unknown>(tete.chemin, {
        rejeu: true,
        method: tete.methode,
        ...(tete.corps === null ? {} : { body: tete.corps }),
      });
    } catch {
      /* Arrêt, sans distinguer la cause. Un 4xx dit que l'action ne passera
         jamais, un 5xx qu'elle passera peut-être — mais les trier ici ferait
         jeter en silence le travail de quelqu'un sur un jugement automatique.
         La file reste, le bandeau la compte, et rien ne se perd sans témoin. */
      return;
    }
    file = file.slice(1);
    await poseLaFile(file);
    annonceLaFile(file.length);
  }
});

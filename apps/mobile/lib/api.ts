import Constants from "expo-constants";
import { NativeModules } from "react-native";
import { errorEnvelopeSchema, type ErrorCode, type ErrorEnvelope, type Session } from "@lehno/contracts";
import { adresseDeLApi } from "./adresse-api.js";
import { doitRenouveler, sortDeLaSession } from "./session.js";
import { effaceLesJetons, litLesJetons, poseLesJetons } from "./jetons.js";
import { unSeulALaFois } from "./verrou.js";

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
export async function appel<T>(chemin: string, options: OptionsDAppel = {}): Promise<T> {
  const { gouvernee = false, ...requete } = options;
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

  return reponse.status === 204 ? (undefined as T) : ((await reponse.json()) as T);
}

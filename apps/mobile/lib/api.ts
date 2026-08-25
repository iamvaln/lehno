import { errorEnvelopeSchema, type ErrorCode, type ErrorEnvelope, type Session } from "@lehno/contracts";
import { doitRenouveler, sortDeLaSession } from "./session.js";
import { effaceLesJetons, litLesJetons, poseLesJetons } from "./jetons.js";

/* Le seul endroit qui parle au serveur.
 *
 * Il porte le jeton, renouvelle en silence quand il a expiré, et rejoue l'appel
 * une fois — une seule. Un second échec après renouvellement n'est plus une
 * question de session : insister ferait une boucle.
 */

const BASE = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3000";

export class ErreurDApi extends Error {
  constructor(
    readonly statut: number,
    readonly enveloppe: ErrorEnvelope | null,
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
  return fetch(`${BASE}/v1${chemin}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
      ...options.headers,
    },
  });
}

/* Appelle une surface publique — pas de jeton, pas de renouvellement. */
export async function appelPublic<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const reponse = await envoie(chemin, options);
  if (!reponse.ok) throw new ErreurDApi(reponse.status, await litLEnveloppe(reponse));
  return reponse.status === 204 ? (undefined as T) : ((await reponse.json()) as T);
}

async function renouvelle(rafraichissement: string): Promise<boolean> {
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
export async function appel<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const jetons = await litLesJetons();
  if (!jetons) throw new ErreurDApi(401, null);

  let reponse = await envoie(chemin, options, jetons.acces);

  if (!reponse.ok) {
    const enveloppe = await litLEnveloppe(reponse);

    if (doitRenouveler(reponse.status, enveloppe?.code ?? null)) {
      if (!(await renouvelle(jetons.rafraichissement))) {
        await effaceLesJetons();
        throw new ErreurDApi(401, enveloppe);
      }
      const neufs = await litLesJetons();
      reponse = await envoie(chemin, options, neufs?.acces);
      if (!reponse.ok) throw new ErreurDApi(reponse.status, await litLEnveloppe(reponse));
    } else {
      if (sortDeLaSession(enveloppe?.code ?? null)) await effaceLesJetons();
      throw new ErreurDApi(reponse.status, enveloppe);
    }
  }

  return reponse.status === 204 ? (undefined as T) : ((await reponse.json()) as T);
}

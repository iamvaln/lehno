import type { ZodType } from "zod";
import type { AdminRole, ErrorCode } from "@lehno/contracts";
import { errorEnvelopeSchema, sessionAdminSchema } from "@lehno/contracts";

/**
 * Le seul endroit de l'outil qui connaisse une URL, un jeton ou un statut HTTP.
 * Les écrans reçoivent des données ou un code d'erreur — jamais un `Response`,
 * jamais un message venu du serveur.
 */

export type Session = {
  acces: string;
  rafraichissement: string;
  role: AdminRole;
  /**
   * L'adresse de qui est entré.
   *
   * Elle n'est pas dans le jeton, et le serveur ne la rend ni à la
   * vérification ni au rafraîchissement : c'est le client qui la connaît, pour
   * l'avoir saisie. Elle sert à reconnaître son propre compte dans une liste —
   * on n'agit ni sur son rôle ni sur son accès, et le serveur refuse les deux.
   *
   * Facultative : une session ouverte avant que ce champ existe reste valable,
   * elle ne sait simplement pas se reconnaître.
   */
  email?: string | undefined;
};

/**
 * Le magasin est passé de l'extérieur : le client ne doit connaître ni le
 * stockage du navigateur ni sa disponibilité. Un onglet privé peut le refuser,
 * et un test n'a aucune raison d'en monter un.
 */
export type MagasinSession = {
  lire(): Session | null;
  ecrire(session: Session): void;
  effacer(): void;
};

// Le serveur rend un code stable ; le client en ajoute deux qui ne peuvent pas
// venir de lui. Une panne de réseau n'est pas une erreur interne du serveur, et
// une réponse hors schéma n'est pas une erreur de la requête.
export type CodeClient = ErrorCode | "reseau_indisponible" | "reponse_invalide";

/**
 * Une erreur d'API porte un code, pas une phrase. Le message du serveur est
 * destiné au journal — il est écrit dans une seule langue et cite des
 * identifiants internes. L'outil traduit le code (contrat commun §2).
 */
export class ErreurApi extends Error {
  readonly code: CodeClient;
  readonly statut: number;

  constructor(code: CodeClient, statut: number) {
    // Le message porte le code, pas le texte du serveur : ce qui remonte dans
    // une trace de pile ne doit rien apprendre de plus que ce qu'on affiche.
    super(code);
    this.name = "ErreurApi";
    this.code = code;
    this.statut = statut;
  }
}

// Le statut ne suffit pas à nommer la cause, mais il la borne. On ne s'en sert
// que si le corps ne porte pas d'enveloppe lisible — un serveur en panne rend
// parfois du HTML.
const CODE_PAR_DEFAUT = (statut: number): ErrorCode => {
  if (statut === 401) return "unauthorized";
  if (statut === 403) return "forbidden";
  if (statut === 404) return "not_found";
  if (statut === 409) return "conflict";
  if (statut === 422) return "validation_failed";
  if (statut === 429) return "rate_limited";
  return "internal_error";
};

export type Options<T> = {
  methode?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  corps?: unknown;
  /** Le schéma de la réponse attendue. Sans lui, le corps n'est pas rendu. */
  schema?: ZodType<T>;
  requete?: Record<string, string | undefined>;
};

export type Client = {
  appeler<T = undefined>(chemin: string, options?: Options<T>): Promise<T>;
  /**
   * Le même appel, mais qui rend le corps tel quel.
   *
   * Un export rend un fichier, pas du JSON : il n'y a pas de schéma à lui
   * appliquer, et le valider n'aurait pas de sens. Le reste — jeton,
   * rafraîchissement, traduction du refus en code — est identique, et c'est
   * pour ça que ce n'est pas un second client.
   */
  appelerTexte(chemin: string, options?: Omit<Options<never>, "schema">): Promise<string>;
  session(): Session | null;
  ouvrir(session: Session): void;
  fermer(): void;
};

export function creerClient(
  { base, magasin, fetch: injecte }:
  { base: string; magasin: MagasinSession; fetch?: typeof globalThis.fetch },
): Client {
  // Résolu à l'appel, jamais à la création : le client est instancié au
  // chargement du module, et figer `globalThis.fetch` à cet instant capturerait
  // une implémentation que l'hôte peut encore remplacer — un service worker qui
  // s'installe, une instrumentation, un test.
  const appeler = (...arguments_: Parameters<typeof globalThis.fetch>): Promise<Response> =>
    (injecte ?? globalThis.fetch)(...arguments_);
  const url = (chemin: string, requete?: Record<string, string | undefined>): string => {
    const complet = `${base.replace(/\/$/, "")}/${chemin.replace(/^\//, "")}`;
    if (!requete) return complet;
    const parametres = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(requete)) {
      if (valeur !== undefined && valeur !== "") parametres.set(cle, valeur);
    }
    const chaine = parametres.toString();
    return chaine ? `${complet}?${chaine}` : complet;
  };

  // Une réponse d'erreur passe par l'enveloppe des contrats. Un corps illisible
  // — HTML d'un relais, corps vide — retombe sur le statut plutôt que de faire
  // échouer la lecture de l'échec, ce qui masquerait la cause d'origine.
  const lireEchec = async (reponse: Response): Promise<ErreurApi> => {
    let corps: unknown;
    try {
      corps = await reponse.json();
    } catch {
      return new ErreurApi(CODE_PAR_DEFAUT(reponse.status), reponse.status);
    }
    const enveloppe = errorEnvelopeSchema.safeParse(corps);
    return new ErreurApi(
      enveloppe.success ? enveloppe.data.code : CODE_PAR_DEFAUT(reponse.status),
      reponse.status,
    );
  };

  const envoyer = async (
    chemin: string,
    options: Options<unknown>,
    jeton: string | null,
  ): Promise<Response> => {
    const entetes = new Headers();
    if (jeton) entetes.set("authorization", `Bearer ${jeton}`);
    if (options.corps !== undefined) entetes.set("content-type", "application/json");
    try {
      return await appeler(url(chemin, options.requete), {
        method: options.methode ?? "GET",
        headers: entetes,
        ...(options.corps !== undefined ? { body: JSON.stringify(options.corps) } : {}),
      });
    } catch {
      // fetch ne jette que sur une panne de transport : réseau coupé, DNS,
      // requête interrompue. Sans ce code, l'écran dirait « erreur interne » à
      // quelqu'un dont le wifi vient de tomber.
      throw new ErreurApi("reseau_indisponible", 0);
    }
  };

  // Une seule reprise après rafraîchissement. Deux masqueraient une boucle : un
  // serveur qui rend 401 sur tout, jeton neuf compris, doit fermer la session
  // plutôt que tourner.
  const rafraichir = async (session: Session): Promise<Session> => {
    const reponse = await envoyer(
      "/admin/auth/refresh",
      { methode: "POST", corps: { refreshToken: session.rafraichissement } },
      null,
    );
    if (!reponse.ok) {
      magasin.effacer();
      throw await lireEchec(reponse);
    }
    const paire = sessionAdminSchema.safeParse(await reponse.json().catch(() => null));
    if (!paire.success) {
      magasin.effacer();
      throw new ErreurApi("reponse_invalide", reponse.status);
    }
    const neuve: Session = {
      acces: paire.data.accessToken,
      rafraichissement: paire.data.refreshToken,
      role: paire.data.role,
      // Reportée : le serveur ne la rend pas au rafraîchissement, et la perdre
      // au premier tour ferait oublier à la session qui elle est.
      ...(session.email !== undefined ? { email: session.email } : {}),
    };
    magasin.ecrire(neuve);
    return neuve;
  };

  // Le corps d'une réponse ne se lit qu'une fois : les deux chemins partagent
  // donc l'envoi et la reprise, et se séparent au moment de lire.
  const executer = async (chemin: string, options: Options<unknown>): Promise<Response> => {
    const session = magasin.lire();
    let reponse = await envoyer(chemin, options, session?.acces ?? null);

    if (reponse.status === 401 && session) {
      const neuve = await rafraichir(session);
      reponse = await envoyer(chemin, options, neuve.acces);
      if (reponse.status === 401) {
        magasin.effacer();
        throw await lireEchec(reponse);
      }
    }

    if (!reponse.ok) throw await lireEchec(reponse);
    return reponse;
  };

  return {
    session: () => magasin.lire(),
    ouvrir: (session) => magasin.ecrire(session),
    fermer: () => magasin.effacer(),

    async appelerTexte(chemin: string, options: Omit<Options<never>, "schema"> = {}): Promise<string> {
      return (await executer(chemin, options)).text();
    },

    async appeler<T>(chemin: string, options: Options<T> = {}): Promise<T> {
      const reponse = await executer(chemin, options);

      // Rien à lire derrière un 204, et rien à lire non plus si l'appelant
      // n'attend pas de forme : un corps qu'on ne sait pas valider ne doit pas
      // atteindre un écran.
      if (reponse.status === 204 || !options.schema) return undefined as T;

      let corps: unknown;
      try {
        corps = await reponse.json();
      } catch {
        throw new ErreurApi("reponse_invalide", reponse.status);
      }
      const valide = options.schema.safeParse(corps);
      // Une réponse hors schéma est un défaut de serveur. La laisser passer la
      // ferait échouer plus loin, dans un écran, où la cause ne se lit plus.
      if (!valide.success) throw new ErreurApi("reponse_invalide", reponse.status);
      return valide.data;
    },
  };
}

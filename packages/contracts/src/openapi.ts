import { z } from "zod";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  waitlistJoinSchema,
  waitlistJoinResponseSchema,
  contactSendSchema,
  contactSendResponseSchema,
  publicConfigSchema,
  LEGAL_DOCUMENTS,
  LEGAL_LANGUAGES,
} from "./public.js";
import {
  requestOtpSchema,
  verifyOtpSchema,
  federatedSchema,
  refreshSchema,
  sessionSchema,
} from "./auth.js";
import { profileSchema, updateProfileSchema, usernameSchema } from "./profile.js";
import { errorEnvelopeSchema } from "./errors.js";
import { personSchema, createPersonSchema } from "./me.js";

// Le contrat se CALCULE depuis les schémas Zod, il ne se recopie pas. Une
// seconde déclaration des mêmes formes — en DTO décoré, par exemple — dériverait
// de la première dès la première correction.
const schema = (s: ZodTypeAny): object => zodToJsonSchema(s, { target: "openApi3" });

// Deux formes de réponse n'ont pas de foyer dans un contrat de domaine : elles
// ne décrivent ni la liste d'attente, ni le contact, ni un profil, seulement
// l'accusé d'un point d'entrée d'authentification ou de disponibilité. Elles
// sont définies une fois, ici, plutôt que recopiées à chaque chemin qui les sert.
const sentResponseSchema = z.object({ sent: z.literal(true) }).strict();
const usernameAvailableResponseSchema = z.object({ available: z.boolean() }).strict();

type Chemin = {
  chemin: string;
  methode: "get" | "post" | "patch" | "delete";
  resume: string;
  authentifie?: boolean;
  // Paramètres de chemin ou de requête, chacun tiré d'un schéma déjà exporté
  // — jamais retapé en une forme parallèle qui pourrait diverger.
  parametres?: { nom: string; dans: "path" | "query"; schema: ZodTypeAny; requis?: boolean }[];
  corps?: ZodTypeAny;
  reponse?: ZodTypeAny;
  // Type de contenu de la réponse de succès : JSON par défaut. Le seul
  // chemin qui rend un document plutôt qu'une forme validée (les documents
  // légaux, servis en Markdown) le déclare ici.
  typeContenuReponse?: string;
  // 204 : pas de corps de réponse à décrire (voir DELETE /auth/session).
  sansContenu?: boolean;
  statut?: number;
};

// Une entrée par chemin servi. Les tâches suivantes ajoutent les leurs ici, et
// le test de péremption refuse un contrat qui ne les décrit pas.
//
// Recensés depuis apps/api/src/app.module.ts (liste `controllers`), pas
// recopiés d'une mémoire du plan : un contrat qui tait un chemin réellement
// câblé ment autant qu'un contrat périmé.
const CHEMINS: Chemin[] = [
  // ——— public/* (apps/api/src/public) ———————————————————————————
  {
    chemin: "/public/waitlist",
    methode: "post",
    resume: "S'inscrire à la liste d'attente",
    corps: waitlistJoinSchema,
    reponse: waitlistJoinResponseSchema,
  },
  {
    chemin: "/public/contact",
    methode: "post",
    resume: "Écrire à l'équipe",
    corps: contactSendSchema,
    reponse: contactSendResponseSchema,
  },
  {
    chemin: "/public/config",
    methode: "get",
    resume: "Lire la configuration publique (prix, crédits offerts, devise)",
    reponse: publicConfigSchema,
  },
  {
    chemin: "/public/legal/{document}",
    methode: "get",
    resume: "Lire un document légal (CGU, confidentialité, mentions)",
    parametres: [
      { nom: "document", dans: "path", schema: z.enum(LEGAL_DOCUMENTS), requis: true },
      { nom: "lang", dans: "query", schema: z.enum(LEGAL_LANGUAGES), requis: false },
    ],
    typeContenuReponse: "text/markdown",
  },
  // ——— auth/* (apps/api/src/auth) ————————————————————————————————
  {
    chemin: "/auth/otp",
    methode: "post",
    resume: "Demander un code de connexion à usage unique par courriel",
    corps: requestOtpSchema,
    reponse: sentResponseSchema,
  },
  {
    chemin: "/auth/otp/verify",
    methode: "post",
    resume: "Vérifier le code reçu et ouvrir une session",
    corps: verifyOtpSchema,
    reponse: sessionSchema,
  },
  {
    chemin: "/auth/federated",
    methode: "post",
    resume: "Se connecter via une identité fédérée (Google, Apple)",
    corps: federatedSchema,
    reponse: sessionSchema,
  },
  {
    chemin: "/auth/refresh",
    methode: "post",
    resume: "Renouveler une session à partir du jeton de rafraîchissement",
    corps: refreshSchema,
    reponse: sessionSchema,
  },
  {
    chemin: "/auth/session",
    methode: "delete",
    resume: "Clore la session (révoque la famille du jeton de rafraîchissement)",
    authentifie: true,
    corps: refreshSchema,
    sansContenu: true,
    statut: 204,
  },
  // ——— me/profile (apps/api/src/me) ———————————————————————————————
  {
    chemin: "/me/profile",
    methode: "get",
    resume: "Lire son propre profil",
    authentifie: true,
    reponse: profileSchema,
  },
  {
    chemin: "/me/profile",
    methode: "patch",
    resume: "Modifier son propre profil",
    authentifie: true,
    corps: updateProfileSchema,
    reponse: profileSchema,
  },
  {
    chemin: "/me/profile/username-available",
    methode: "get",
    resume: "Vérifier la disponibilité d'un identifiant",
    authentifie: true,
    parametres: [{ nom: "username", dans: "query", schema: usernameSchema, requis: true }],
    reponse: usernameAvailableResponseSchema,
  },
  // ——— me/persons (apps/api/src/me) ————————————————————————————————
  {
    chemin: "/me/persons",
    methode: "get",
    resume: "Lister ses proches",
    authentifie: true,
    reponse: z.array(personSchema),
  },
  {
    chemin: "/me/persons",
    methode: "post",
    resume: "Ajouter un proche à l'annuaire",
    authentifie: true,
    corps: createPersonSchema,
    reponse: personSchema,
  },
];

export function construireOpenApi(): object {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const c of CHEMINS) {
    paths[c.chemin] ??= {};
    const typeContenu = c.typeContenuReponse ?? "application/json";
    paths[c.chemin]![c.methode] = {
      summary: c.resume,
      ...(c.authentifie ? { security: [{ bearerAuth: [] }] } : {}),
      ...(c.parametres
        ? {
            parameters: c.parametres.map((p) => ({
              name: p.nom,
              in: p.dans,
              required: p.requis ?? p.dans === "path",
              schema: schema(p.schema),
            })),
          }
        : {}),
      ...(c.corps ? { requestBody: { required: true, content: { "application/json": { schema: schema(c.corps) } } } } : {}),
      responses: {
        [String(c.statut ?? 200)]: {
          description: "Succès",
          ...(c.sansContenu
            ? {}
            : c.reponse
              ? { content: { [typeContenu]: { schema: typeContenu === "application/json" ? schema(c.reponse) : { type: "string" } } } }
              : {}),
        },
        "4XX": {
          description: "Refus — la requête ne satisfait pas le contrat (forme, valeur, droit) ; corriger avant de réessayer.",
          content: { "application/json": { schema: schema(errorEnvelopeSchema) } },
        },
        // internal_error (statusForCode le fixe à 500, voir
        // apps/api/src/common/errors.ts) — rendu par AppExceptionFilter sur
        // toute exception non prévue, y compris hors AppError, donc atteignable
        // depuis n'importe quel chemin. Une défaillance du serveur, pas un
        // refus de la requête : le client devrait réessayer, pas corriger sa
        // demande — d'où un bloc séparé du "4XX" plutôt qu'absorbé dedans.
        "500": {
          description: "Défaillance du serveur — la requête n'y est pour rien, on peut réessayer sans la modifier.",
          content: { "application/json": { schema: schema(errorEnvelopeSchema) } },
        },
      },
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Lehno",
      version: "1",
      description: "L'assistant des dates qui comptent. Le contrat est engendré depuis les schémas Zod de @lehno/contracts — il ne s'écrit pas à la main.",
    },
    servers: [{ url: "https://api.lehno.app/v1" }, { url: "http://localhost:3001/v1", description: "développement" }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    },
    paths,
  };
}

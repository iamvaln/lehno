import { randomUUID } from "node:crypto";
import type { NestMiddleware } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { ENTETES_CLIENT } from "@lehno/contracts";
import { dansLeContexte, lireEntetes } from "../tracking/contexte.js";
import { ClientApiService } from "../clients/client-api.service.js";

// Forme d'UUID stricte : bornée en longueur, jeu de caractères restreint à
// l'hexadécimal et au tiret. Un en-tête client forgé (retour à la ligne,
// séquence d'échappement) ne peut donc jamais atteindre le journal.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidCorrelationId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(@Inject(ClientApiService) private readonly clients: ClientApiService) {}

  // req/res restent non typés : le middleware doit rester indépendant de la plateforme HTTP (express ou fastify).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async use(req: any, res: any, next: () => void): Promise<void> {
    // Ce middleware tourne hors du pipeline d'exceptions de Nest : une erreur
    // qu'il lèverait échapperait à AppExceptionFilter. La corrélation est un
    // confort de diagnostic, jamais une raison de faire échouer la requête —
    // au moindre doute, on en génère une nouvelle plutôt que de lever.
    let id: string;
    try {
      const header: unknown = req?.headers?.["x-correlation-id"];
      const candidate = Array.isArray(header) ? header[0] : header;
      id = isValidCorrelationId(candidate) ? candidate : randomUUID();
    } catch {
      id = randomUUID();
    }

    try {
      req.correlationId = id;
      res.setHeader("x-correlation-id", id);
    } catch {
      // rien à faire : la requête continue même si l'en-tête n'a pas pu être posé.
    }

    // Le contexte de mesure vit pour la DURÉE de la requête, sous le même
    // raisonnement que ce middleware : il ne doit jamais la faire échouer. Un
    // en-tête absent ou forgé donne un contexte vide, pas une exception.
    let contexte;
    try {
      contexte = lireEntetes((req?.headers ?? {}) as Record<string, unknown>, id);
    } catch {
      contexte = lireEntetes({}, id);
    }
    /* QUI APPELLE, ET DEPUIS QUEL BUILD.
     *
     * EN PHASE 1 ON NE REFUSE RIEN : un appel sans en-têtes passe et se note
     * « absent ». Bloquer d'emblée couperait les applications déjà installées,
     * qui n'envoient rien — et on découvrirait la panne en production. On
     * commence par regarder, et la garde s'allumera quand le journal montrera
     * que les appels portent leurs en-têtes.
     *
     * Comme le reste de ce middleware, ça ne doit JAMAIS faire échouer la
     * requête : la traçabilité est un confort de diagnostic. Au moindre doute,
     * verdict nul plutôt qu'exception. */
    try {
      const verdict = await this.clients.resoudre({
        clientId: contexte.clientId,
        clientKey: cleAnnoncee(req),
        clientType: contexte.clientType,
      });
      contexte.clientVerdict = verdict.etat;
    } catch {
      contexte.clientVerdict = null;
    }

    dansLeContexte(contexte, next);
  }
}

/* LA CLÉ NE VA PAS DANS LE CONTEXTE, et c'est délibéré : le contexte se
   journalise, et une clé journalisée est une clé publiée. On la lit ici, on la
   passe au service, et elle n'existe plus après. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleAnnoncee(req: any): string | null {
  try {
    const brut: unknown = req?.headers?.[ENTETES_CLIENT.clientKey];
    const valeur = Array.isArray(brut) ? brut[0] : brut;
    return typeof valeur === "string" && valeur.length > 0 ? valeur : null;
  } catch {
    return null;
  }
}

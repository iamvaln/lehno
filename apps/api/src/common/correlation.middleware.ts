import { randomUUID } from "node:crypto";
import type { NestMiddleware } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { dansLeContexte, lireEntetes } from "../tracking/contexte.js";

// Forme d'UUID stricte : bornée en longueur, jeu de caractères restreint à
// l'hexadécimal et au tiret. Un en-tête client forgé (retour à la ligne,
// séquence d'échappement) ne peut donc jamais atteindre le journal.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidCorrelationId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  // req/res restent non typés : le middleware doit rester indépendant de la plateforme HTTP (express ou fastify).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  use(req: any, res: any, next: () => void): void {
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
    dansLeContexte(contexte, next);
  }
}

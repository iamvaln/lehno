import { AsyncLocalStorage } from "node:async_hooks";
import { ENTETES_MESURE, SURFACES, type Surface } from "@lehno/contracts";

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
  };
}

/* Un en-tête est écrit par le client : il peut être répété, démesuré, ou
 * porter un retour à la ligne pour casser une ligne de journal. On le borne et
 * on le nettoie AVANT qu'il n'aille où que ce soit — même règle que
 * CorrelationMiddleware, pour la même raison. */
const LONGUEUR_MAX = 64;

function propre(valeur: unknown): string | null {
  const brut = Array.isArray(valeur) ? valeur[0] : valeur;
  if (typeof brut !== "string") return null;
  const net = brut.replace(/[^\w.\-+]/g, "").slice(0, LONGUEUR_MAX);
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
    appVersion: propre(entetes[ENTETES_MESURE.appVersion]),
    language: propre(entetes[ENTETES_MESURE.language]),
    theme: propre(entetes[ENTETES_MESURE.theme]),
    sessionId: propre(entetes[ENTETES_MESURE.sessionId]),
    correlationId,
  };
}

import { contexteCourant } from "../tracking/contexte.js";

/* D'OÙ VIENT LA LIGNE QU'ON S'APPRÊTE À ÉCRIRE.
 *
 * Six tables la portent — `login_activity`, `audit_log`, `ai_usage`,
 * `action_run`, `credit_transaction`, `payment` —, et la règle est la même pour
 * toutes : une ligne qu'on relira un jour pour comprendre ce qui s'est passé dit
 * d'où elle vient.
 *
 * UNE SEULE FONCTION, ÉTALÉE AU POINT D'ÉCRITURE. Recopier les cinq champs à
 * vingt endroits les ferait diverger au premier ajout ; les poser par une
 * extension du client Prisma les rendrait invisibles à la lecture, et
 * `PrismaService` étend `PrismaClient` — `$extends` rendrait un autre type et
 * casserait l'injection partout.
 *
 * TOUT EST NUL HORS REQUÊTE, et c'est un état légitime : un passage programmé,
 * un semis, un test unitaire n'ont pas de client. On ne lève pas — la
 * traçabilité ne fait jamais échouer ce qu'elle trace.
 */
export function origine(): {
  clientId: string | null;
  clientType: string | null;
  appVersion: string | null;
  osName: string | null;
  osVersion: string | null;
} {
  const c = contexteCourant();
  return {
    clientId: c.clientId,
    clientType: c.clientType,
    appVersion: c.appVersion,
    osName: c.osName,
    osVersion: c.osVersion,
  };
}

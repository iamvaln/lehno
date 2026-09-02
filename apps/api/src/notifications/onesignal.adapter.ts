import type { EnvoiPousse, PushPort } from "./push.port.js";

const URL_ONESIGNAL = "https://api.onesignal.com/notifications";

/* Combien de temps on attend OneSignal avant d'abandonner.
 *
 * Sans borne, un tiers qui ne répond plus bloquerait le passage entier :
 * l'envoi traite jusqu'à 200 lignes de suite, et une seule requête pendue les
 * retiendrait toutes. Mieux vaut une notification en échec, visible dans la
 * file, qu'un ordonnanceur figé dont personne ne remarque l'arrêt. */
const DELAI_MS = 10_000;

export class PousseOneSignal implements PushPort {
  constructor(
    private readonly appId: string,
    private readonly cle: string,
  ) {}

  async envoyer(e: EnvoiPousse): Promise<void> {
    /* Aucun destinataire : on ne fait pas la requête.
       OneSignal refuse un envoi sans cible, et l'erreur qu'il rend parlerait
       d'un « segment invalide » — un message qui envoie chercher la panne au
       mauvais endroit. */
    if (e.jetons.length === 0) return;

    const reponse = await fetch(URL_ONESIGNAL, {
      method: "POST",
      headers: {
        // `Key`, pas `Basic` : c'est la forme de l'API actuelle. L'ancienne
        // acceptait `Basic <clé REST>`, et les deux traînent dans les exemples
        // qu'on trouve en ligne.
        Authorization: `Key ${this.cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: this.appId,
        include_subscription_ids: e.jetons,
        /* Le texte est DÉJÀ dans la langue de qui reçoit — il a été composé
           par @lehno/i18n d'après `uiLanguage`, relue au moment de l'envoi.
           On le range malgré tout sous la clé `en`, parce que OneSignal exige
           cette clé comme langue de repli et refuse l'envoi sans elle. Ce
           n'est donc pas un oubli de traduction : c'est un français rangé
           sous « en », et le renommer casserait l'envoi. */
        headings: { en: e.titre },
        contents: { en: e.corps },
        ...(e.donnees ? { data: e.donnees } : {}),
      }),
      signal: AbortSignal.timeout(DELAI_MS),
    });

    if (!reponse.ok) {
      /* Le corps de la réponse entre dans l'erreur, borné.
         OneSignal explique ses refus dans le corps, pas dans le statut : un
         « 400 » seul ne distingue pas une clé d'API fausse d'un jeton
         d'appareil périmé, et ce sont deux pannes qui se réparent
         différemment. */
      const detail = (await reponse.text().catch(() => "")).slice(0, 300);
      throw new Error(`OneSignal a refusé l'envoi (${reponse.status}) : ${detail}`);
    }
  }
}

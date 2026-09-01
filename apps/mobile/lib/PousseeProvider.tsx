import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { OneSignal } from "react-native-onesignal";
import { appel } from "./api.js";
import { litLesJetons, surChangementDeSession } from "./jetons.js";
import {
  corpsDEnregistrement, doitEnregistrer, plateformeDeLAppareil,
  type EtatDePoussee,
} from "./push.js";

/* LES NOTIFICATIONS POUSSÉES — le seul endroit qui parle à OneSignal.
 *
 * L'IDENTIFIANT D'APPLICATION vient de `ONESIGNAL_APP_ID`, lue par
 * `app.config.js` À LA CONSTRUCTION et déposée dans `extra`.
 *
 * Pas par une variable `EXPO_PUBLIC_` : Expo n'injecte dans le paquet client
 * que celles-là, ce qui aurait obligé à DUPLIQUER la variable sous un second
 * nom — deux entrées pour une seule valeur, qui divergent le jour où l'on n'en
 * change qu'une. Le fichier de configuration, lui, s'exécute sur la machine qui
 * construit et lit la variable telle qu'elle est.
 *
 * Ce n'est pas un secret — il voyage dans chaque installation — mais il ne
 * s'écrit pas en dur pour autant : sans variable, la recette et la production
 * partageraient le même flux, et un essai ferait sonner de vrais téléphones.
 *
 * ABSENT, ON NE FAIT RIEN — et sans bruit. Un poste de développement qui ne
 * l'a pas posée doit démarrer normalement : les notifications sont une
 * commodité, pas une condition de fonctionnement.
 */
const APP_ID = typeof Constants.expoConfig?.extra?.["oneSignalAppId"] === "string"
  ? Constants.expoConfig.extra["oneSignalAppId"]
  : null;

/* LA DEMANDE DE PERMISSION, à déclencher depuis un écran.
 *
 * `false` : on ne renvoie pas vers les réglages du téléphone quand elle a déjà
 * été refusée. Un aller-retour vers les réglages système, à quelqu'un qui vient
 * de dire non, se lit comme de l'insistance.
 *
 * Rend `true` si la permission est acquise — l'écran appelant peut alors dire
 * ce qui va se passer, ou ce qui ne se passera pas.
 */
export async function demandeLaPermission(): Promise<boolean> {
  if (!APP_ID) return false;
  return OneSignal.Notifications.requestPermission(false);
}

export function PousseeProvider({ children }: { children: ReactNode }) {
  /* L'état vit dans une référence et non dans un `state` : il ne se rend pas,
     et le passer en état relancerait le rendu de l'application entière à
     chaque enregistrement. */
  const etat = useRef<EtatDePoussee>({ jetonEnregistre: null });
  const pret = useRef(false);

  /* CE QUI DÉCLENCHE L'ENVOI, et il y a trois entrées : l'initialisation, le
     changement de session, et l'arrivée d'un jeton. Elles convergent ici pour
     qu'une seule règle décide — trois conditions écrites à trois endroits
     finiraient par se contredire. */
  const enregistre = useCallback(async () => {
    if (!pret.current) return;
    const jeton = OneSignal.User.pushSubscription.getPushSubscriptionId();
    const connecte = (await litLesJetons()) !== null;
    if (!doitEnregistrer(etat.current, jeton, connecte)) return;

    const plateforme = plateformeDeLAppareil(Platform.OS);
    if (plateforme === null) return;

    try {
      await appel<unknown>("/me/devices", {
        method: "POST",
        body: JSON.stringify(
          corpsDEnregistrement(jeton!, plateforme, Constants.expoConfig?.version),
        ),
      });
      /* On ne retient le jeton QU'APRÈS un envoi réussi : le retenir avant
         ferait croire l'appareil enregistré alors que l'appel a échoué, et
         plus rien ne réessaierait — le téléphone resterait silencieux sans
         qu'aucun écran ne le montre. */
      etat.current = { jetonEnregistre: jeton };
    } catch {
      /* L'échec ne se montre PAS. On ne s'inscrit pas aux notifications, on
         les reçoit : afficher une erreur ici interromprait quelqu'un au sujet
         d'une chose qu'il n'a pas demandée. Le prochain démarrage réessaiera,
         puisque le jeton n'a pas été retenu. */
    }
  }, []);

  useEffect(() => {
    if (!APP_ID) return;

    OneSignal.initialize(APP_ID);
    pret.current = true;

    /* LA PERMISSION NE SE DEMANDE PAS ICI, et c'est délibéré.
     *
     * iOS ne pose la question QU'UNE FOIS. Refusée, elle ne se rouvre plus
     * qu'en allant dans les réglages du téléphone — un chemin que presque
     * personne ne prend. La demander au démarrage à froid, avant que
     * quiconque ait vu à quoi servent les rappels, c'est donc dépenser
     * l'unique cartouche au pire moment.
     *
     * `demandeLaPermission` est exportée pour qu'un écran la déclenche quand
     * elle a du sens — au moment où l'on active un rappel, là où la question
     * répond à quelque chose qu'on vient de demander. L'initialisation, elle,
     * se contente de préparer le terrain.
     */

    /* Le jeton n'existe pas au moment de l'initialisation : il arrive quand
       l'abonnement se crée, après la permission. Sans cet abonnement, on
       n'enregistrerait que les démarrages où il se trouve déjà là — soit
       jamais au premier lancement. */
    const surAbonnement = () => { void enregistre(); };
    OneSignal.User.pushSubscription.addEventListener("change", surAbonnement);

    /* ET À CHAQUE OUVERTURE DE SESSION. Un jeton reçu avant la connexion n'a
       aucun compte auquel se rattacher ; il faut donc repasser quand la
       session arrive. */
    const detache = surChangementDeSession(() => { void enregistre(); });

    void enregistre();

    return () => {
      OneSignal.User.pushSubscription.removeEventListener("change", surAbonnement);
      detache();
    };
  }, [enregistre]);

  return <>{children}</>;
}

import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from "react";
import * as Network from "expo-network";
import { horsConnexion, poseLEtatDuReseau, type EtatDuReseau } from "./reseau.js";
import { rejoueLaFile, surLaFile } from "./api.js";
import { litLaFile } from "./fileStockee.js";

/* L'ÉTAT DU RÉSEAU, lu à la source et partagé.
 *
 * Un état par écran ferait autant d'abonnements que d'écrans montés, et deux
 * écrans pourraient se contredire pendant la seconde où l'un a reçu la
 * bascule et l'autre pas. Il n'y a qu'un réseau ; il n'y a qu'un état.
 *
 * ON NE DÉDUIT RIEN D'UN ÉCHEC. Voir `reseau.ts` : un serveur en panne, un
 * jeton expiré et un avion en vol se ressemblent au point d'échec, et
 * promettre « ça repartira au retour du réseau » à quelqu'un dont le compte
 * est fermé serait une promesse que rien ne tiendra.
 *
 * Ce provider ne fait AUCUN appel réseau lui-même — la mesure vient du
 * système. Interroger une adresse à nous pour savoir si le réseau va
 * consommerait de la donnée mobile en boucle, et confondrait à nouveau notre
 * panne avec l'absence de réseau.
 */
const Contexte = createContext<{ horsLigne: boolean; enAttente: number }>(
  { horsLigne: false, enAttente: 0 },
);

export function ReseauProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatDuReseau | null>(null);
  const [enAttente, setEnAttente] = useState(0);

  /* On publie l'état hors de React à chaque changement : `appel` n'est pas un
     composant et ne peut pas lire ce contexte, alors que c'est lui qui décide
     de se replier sur le cache. Un provider unique reste l'unique écrivain. */
  useEffect(() => { poseLEtatDuReseau(etat); }, [etat]);

  useEffect(() => {
    let vivant = true;

    /* La première lecture ne vient PAS de l'abonnement : celui-ci ne parle
       qu'au premier CHANGEMENT. Sans cette lecture, une application ouverte
       déjà hors connexion se croirait en ligne jusqu'à ce que le réseau
       revienne — c'est-à-dire pendant tout le temps où l'on en a besoin. */
    void Network.getNetworkStateAsync().then((v) => {
      if (vivant) setEtat(v);
    }).catch(() => {
      /* La mesure a échoué : on ne conclut pas à l'absence de réseau. Poser
         `hors connexion` sur un échec de mesure retiendrait des actions pour
         une raison qui n'a rien à voir. */
    });

    const abonnement = Network.addNetworkStateListener((v) => {
      if (vivant) setEtat(v);
    });

    return () => { vivant = false; abonnement.remove(); };
  }, []);

  /* LE COMPTE VIENT DU DISQUE AU DÉMARRAGE, pas de zéro. L'application a pu
     être tuée avec des actions en attente : partir de zéro afficherait une
     bannière muette au-dessus d'une file pleine, et la personne croirait sa
     note perdue. */
  useEffect(() => {
    const vivant = { oui: true };
    void litLaFile().then((f) => { if (vivant.oui) setEnAttente(f.length); }).catch(() => {});
    const detache = surLaFile((n) => { if (vivant.oui) setEnAttente(n); });
    return () => { vivant.oui = false; detache(); };
  }, []);

  const horsLigne = horsConnexion(etat);

  /* LE RETOUR DU RÉSEAU DÉCLENCHE LE REJEU. On le suspend à `horsLigne` plutôt
     qu'à `etat` : deux mesures successives peuvent différer sans que la
     conclusion change — passer du Wi-Fi aux données mobiles ne justifie pas de
     rejouer une file qu'on est déjà en train de vider.

     `rejoueLaFile` garde son entrée, donc un déclenchement de trop ne fait
     rien. C'est voulu : mieux vaut appeler une fois de trop que manquer le
     retour. */
  useEffect(() => {
    if (!horsLigne) void rejoueLaFile();
  }, [horsLigne]);

  return (
    <Contexte.Provider value={{ horsLigne, enAttente }}>
      {children}
    </Contexte.Provider>
  );
}

export function useReseau(): { horsLigne: boolean; enAttente: number } {
  return useContext(Contexte);
}

import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from "react";
import * as Network from "expo-network";
import { horsConnexion, type EtatDuReseau } from "./reseau.js";

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
const Contexte = createContext<{ horsLigne: boolean }>({ horsLigne: false });

export function ReseauProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatDuReseau | null>(null);

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

  return (
    <Contexte.Provider value={{ horsLigne: horsConnexion(etat) }}>
      {children}
    </Contexte.Provider>
  );
}

export function useReseau(): { horsLigne: boolean } {
  return useContext(Contexte);
}

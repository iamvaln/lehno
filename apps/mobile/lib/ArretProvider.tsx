import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { maintenanceStatusSchema, type MaintenanceStatus } from "@lehno/contracts";
import { appelPublic, ErreurDApi, surEchec } from "./api.js";
import { delaiDAttente, estUnArret } from "./arret.js";

/* L'arrêt pour intervention — l'écran qui remplace l'application entière.
 *
 * Il couvre AVANT l'entrée : pendant un arrêt, `/auth/*` et `/public/config`
 * répondent `503` eux aussi. Un écran d'attente posé seulement après la
 * connexion laisserait quelqu'un devant un formulaire qui échoue sans dire
 * pourquoi.
 *
 * Il ne déconnecte personne et ne vide aucun cache : un arrêt n'est pas une
 * invalidation de session. Au retour, on reprend où l'on était.
 *
 * On interroge `/public/maintenance` plutôt que de rejouer l'appel d'origine —
 * ce chemin reste ouvert pendant l'intervention, et lui seul dit quand elle
 * s'achève.
 */

interface Arret {
  enCours: boolean;
  /* Le délai que le serveur annonce, décompté sur place. L'écran l'affiche ;
     il ne l'invente pas, sans quoi deux versions du parc appliqueraient deux
     règles — et mille téléphones reviendraient à la même seconde. */
  secondes: number | null;
  signale: (erreur: unknown) => void;
  reessaie: () => void;
}

const Contexte = createContext<Arret | null>(null);

export function ArretProvider({ children }: { children: ReactNode }) {
  const [enCours, setEnCours] = useState(false);
  const [secondes, setSecondes] = useState<number | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const interroge = useCallback(async () => {
    try {
      const brut = await appelPublic<unknown>("/public/maintenance");
      const etat: MaintenanceStatus = maintenanceStatusSchema.parse(brut);
      if (!etat.maintenance) {
        setEnCours(false);
        setSecondes(null);
        return;
      }
      setEnCours(true);
      setSecondes(delaiDAttente(etat));
    } catch {
      /* Le chemin d'état lui-même ne répond pas. On reste sur l'écran
         d'attente : disparaître pour retomber sur une application qui échoue
         partout serait pire que d'attendre encore. */
      setEnCours(true);
    }
  }, []);

  /* Tout appel qui échoue passe par ici. C'est ainsi qu'un arrêt commencé au
     milieu d'une séance se découvre : il n'attend pas un redémarrage. */
  const signale = useCallback((erreur: unknown) => {
    if (!(erreur instanceof ErreurDApi)) return;
    if (!estUnArret(erreur.statut, erreur.code)) return;
    setEnCours(true);
    setSecondes(delaiDAttente({
      maintenance: true,
      retryAfterSeconds: lireLeDelai(erreur),
    }));
  }, []);

  // Le client signale tout échec ici : un arrêt se découvre sur n'importe quel
  // appel, pas seulement au démarrage.
  useEffect(() => {
    surEchec(signale);
    return () => surEchec(null);
  }, [signale]);

  // Le décompte, puis une interrogation quand il tombe à zéro. Pas de rappel
  // avant : le serveur a dit combien attendre, on attend.
  useEffect(() => {
    if (!enCours || secondes === null) return;
    if (secondes <= 0) { void interroge(); return; }
    minuteur.current = setTimeout(() => setSecondes((s) => (s === null ? null : s - 1)), 1000);
    return () => { if (minuteur.current) clearTimeout(minuteur.current); };
  }, [enCours, secondes, interroge]);

  return (
    <Contexte.Provider value={{ enCours, secondes, signale, reessaie: () => void interroge() }}>
      {children}
    </Contexte.Provider>
  );
}

/* Le `503` porte son délai dans les détails de l'enveloppe. L'y lire évite une
   interrogation immédiate qui se ferait refuser pour la même raison. */
function lireLeDelai(erreur: ErreurDApi): number | null {
  const brut = erreur.enveloppe?.details?.["retryAfterSeconds"];
  return typeof brut === "number" && brut > 0 ? brut : null;
}

export function useArret(): Arret {
  const valeur = useContext(Contexte);
  if (!valeur) throw new Error("useArret hors de ArretProvider");
  return valeur;
}

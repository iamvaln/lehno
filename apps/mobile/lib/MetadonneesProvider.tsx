import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from "react";
import { metadataSchema, type Metadata } from "@lehno/contracts";
import { appel } from "./api.js";
import { surChangementDeSession } from "./jetons.js";

/* Les listes de valeurs du produit, et ce qu'elles VEULENT DIRE.
 *
 * `/me/metadata` sert les sept catégories de notes avec, pour chacune, sa
 * nature — ponctuelle ou durable — et son caractère de contrainte. Aucune
 * énumération ne porte ces deux choses : le contrat donne les codes, le
 * serveur donne leur sens. Les deviner ici reviendrait à réécrire chez nous
 * une règle qui vit là-bas, et à la voir diverger au premier ajout.
 *
 * `eventKinds` est LA liste qui varie : le serveur la filtre selon les
 * drapeaux, et un drapeau peut basculer pendant qu'une session est ouverte. Le
 * contrat demande donc de relire APRÈS CHAQUE CONNEXION, comme `/me/features`
 * — c'est ce que fait l'abonnement au changement de session plus bas.
 */
interface Metadonnees {
  categories: Metadata["categories"];
  /* La seule liste qui varie d'un compte à l'autre : le serveur la FILTRE
     selon les drapeaux. `events.other` éteint, elle rend `["birthday"]`, et le
     formulaire ne propose plus « autre type » sans avoir de règle à connaître.
     C'est ce chemin qu'il faut lire — tester le drapeau referait le
     raisonnement du serveur et s'en écarterait le jour où il change. */
  eventKinds: Metadata["eventKinds"];
  /* Ce que chaque action payante coûte, LU EN BASE. Le prix se règle en
     administration sans livraison : une constante côté client afficherait
     l'ancien tarif sur tout un parc jusqu'à la mise à jour suivante — et un
     écran qui annonce un prix avant de débiter ne peut pas se tromper.

     Une action ABSENTE n'est pas disponible : même convention que les
     drapeaux, ce qui n'est pas là est éteint. */
  premiumActions: Metadata["premiumActions"];
}

// Vide plutôt que nul : un écran monté avant la réponse ne devine rien, il
// n'affiche simplement pas ce qu'il ne sait pas encore.
const Contexte = createContext<Metadonnees>({
  categories: [], eventKinds: [], premiumActions: [],
});

export function MetadonneesProvider({ children }: { children: ReactNode }) {
  const [tout, setTout] = useState<Metadonnees>({
    categories: [], eventKinds: [], premiumActions: [],
  });

  const demande = useCallback(async () => {
    try {
      const lu = metadataSchema.parse(await appel<unknown>("/me/metadata"));
      setTout({
        categories: lu.categories,
        eventKinds: lu.eventKinds,
        premiumActions: lu.premiumActions,
      });
    } catch {
      /* Un échec n'efface pas ce qu'on savait. Sans table, la fiche montre ses
         notes en cartes sans étiquette ni pointillé : moins, jamais faux. */
    }
  }, []);

  useEffect(() => { void demande(); }, [demande]);
  useEffect(() => surChangementDeSession(() => { void demande(); }), [demande]);

  return <Contexte.Provider value={tout}>{children}</Contexte.Provider>;
}

export function useCategories(): Metadata["categories"] {
  return useContext(Contexte).categories;
}

/* Les types d'événement OUVERTS. Vide tant que la réponse n'est pas là : on
   ne propose pas un choix qu'on ne sait pas ouvert. */
export function useTypesOuverts(): Metadata["eventKinds"] {
  return useContext(Contexte).eventKinds;
}

/* Les prix. Vides tant que la réponse n'est pas là — et on n'annonce alors
   aucun coût, plutôt qu'un coût supposé. */
export function useActionsPayantes(): Metadata["premiumActions"] {
  return useContext(Contexte).premiumActions;
}

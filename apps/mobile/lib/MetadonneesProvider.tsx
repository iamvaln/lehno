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
 * Elles ne changent pas en séance : on les lit une fois, et à chaque
 * changement de compte — les listes sont les mêmes, mais le chemin est
 * authentifié et n'aurait rien rendu avant la connexion.
 */
interface Metadonnees {
  categories: Metadata["categories"];
}

// Vide plutôt que nul : un écran monté avant la réponse ne devine rien, il
// n'affiche simplement pas ce qu'il ne sait pas encore.
const Contexte = createContext<Metadonnees>({ categories: [] });

export function MetadonneesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Metadata["categories"]>([]);

  const demande = useCallback(async () => {
    try {
      setCategories(metadataSchema.parse(await appel<unknown>("/me/metadata")).categories);
    } catch {
      /* Un échec n'efface pas ce qu'on savait. Sans table, la fiche montre ses
         notes en cartes sans étiquette ni pointillé : moins, jamais faux. */
    }
  }, []);

  useEffect(() => { void demande(); }, [demande]);
  useEffect(() => surChangementDeSession(() => { void demande(); }), [demande]);

  return <Contexte.Provider value={{ categories }}>{children}</Contexte.Provider>;
}

export function useCategories(): Metadata["categories"] {
  return useContext(Contexte).categories;
}

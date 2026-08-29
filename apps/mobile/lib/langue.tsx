import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { getLocales } from "expo-localization";
import { MESSAGES, type Langue, type Messages } from "../messages/index.js";

/* La langue, et le dictionnaire qui va avec.
 *
 * Elle suit l'appareil au premier lancement, puis le choix explicite s'il y en
 * a un — le profil en porte un, et il l'emporte sur le système comme le thème.
 *
 * Aucun repli d'une langue sur l'autre : `MESSAGES[langue]` existe toujours
 * pour les deux valeurs possibles, et une clé manquante est un défaut de
 * compilation, pas une phrase dans la mauvaise langue.
 */

const Contexte = createContext<{
  langue: Langue;
  t: Messages;
  choisis: (langue: Langue) => void;
} | null>(null);

export function langueDuSysteme(): Langue {
  // Tout ce qui n'est pas explicitement français tombe sur l'anglais : c'est la
  // langue la plus large, et le produit ne prétend pas en servir d'autres.
  return getLocales()[0]?.languageCode === "fr" ? "fr" : "en";
}

export function LangueProvider({ children, choix }: { children: ReactNode; choix?: Langue }) {
  const [choisie, choisis] = useState<Langue | undefined>(choix);
  const valeur = useMemo(() => {
    const langue = choisie ?? langueDuSysteme();
    return { langue, t: MESSAGES[langue], choisis };
  }, [choisie]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

/* Lever plutôt que rendre un repli : un écran hors fournisseur afficherait
   « undefined » à chaque libellé, ce qui se remarque tard et s'explique mal. */
export function useLangue() {
  const valeur = useContext(Contexte);
  if (!valeur) throw new Error("useLangue hors de LangueProvider");
  return valeur;
}

export function useT(): Messages {
  return useLangue().t;
}

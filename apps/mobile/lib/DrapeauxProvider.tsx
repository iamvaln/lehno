import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { estActive, featuresSchema } from "@lehno/contracts";
import { appel } from "./api.js";
import { doitRecharger, etatDeRepli } from "./drapeaux.js";

/* Ce que le produit propose en ce moment.
 *
 * Le serveur rend LA LISTE RÉSOLUE pour le demandeur — ce qui est actif, jamais
 * l'état brut des drapeaux. Il tient le registre, résout les dépendances, et
 * refuse un appel visant une fonctionnalité éteinte. Le client masque, et ne
 * décide de rien : le jour où l'activation deviendra sélective, rien ne changera
 * ici.
 *
 * La liste se recharge au retour au premier plan, avec un délai de grâce : une
 * fonctionnalité éteinte en administration atteint ainsi un téléphone resté
 * ouvert, sans qu'on rappelle le serveur à chaque va-et-vient.
 */

interface Drapeaux {
  actives: readonly string[];
  charge: boolean;
  recharge: () => void;
}

const Contexte = createContext<Drapeaux | null>(null);

export function DrapeauxProvider({ children }: { children: ReactNode }) {
  const [actives, setActives] = useState<readonly string[]>(etatDeRepli());
  const [charge, setCharge] = useState(false);
  const dernierAppel = useRef<number | null>(null);

  const demande = useCallback(async (force = false) => {
    if (!force && !doitRecharger(dernierAppel.current, Date.now())) return;
    dernierAppel.current = Date.now();
    try {
      const brut = await appel<unknown>("/me/features");
      setActives(featuresSchema.parse(brut).features);
    } catch {
      /* Un échec n'efface pas ce qu'on savait : garder la liste précédente vaut
         mieux que de faire disparaître des écrans sur une coupure de réseau.
         C'est seulement au tout premier appel qu'on retombe sur le socle, et
         `actives` vaut déjà le repli à ce moment-là. */
    } finally {
      setCharge(true);
    }
  }, []);

  useEffect(() => {
    void demande(true);
    const abonnement = AppState.addEventListener("change", (etat) => {
      if (etat === "active") void demande();
    });
    return () => abonnement.remove();
  }, [demande]);

  return (
    <Contexte.Provider value={{ actives, charge, recharge: () => void demande(true) }}>
      {children}
    </Contexte.Provider>
  );
}

/* Lever plutôt que rendre un repli : un écran hors fournisseur croirait tout
   éteint et masquerait le produit entier, ce qui se remarque tard et
   s'explique mal. */
export function useDrapeaux(): Drapeaux {
  const valeur = useContext(Contexte);
  if (!valeur) throw new Error("useDrapeaux hors de DrapeauxProvider");
  return valeur;
}

/* La question que les écrans posent. Le socle répond toujours oui — c'est ce
   que le produit est quand tout le reste est éteint — et un drapeau inconnu
   vaut éteint, parce qu'une version installée ignore une clé créée après elle. */
export function useEstActive(capacite: string): boolean {
  return estActive(useDrapeaux().actives, capacite);
}

import { useCallback, useEffect, useRef, useState } from "react";
import { ErreurApi } from "./client.js";
import { codeConnu, type CleCode } from "../i18n/index.js";

/**
 * Charger une ressource, et dire dans quel état on est.
 *
 * Trois états, pas deux. « Pas encore chargé » et « chargé, et il n'y a rien »
 * se ressemblent à l'écran et ne veulent pas dire la même chose : sans état
 * d'attente, une base lente ressemble à un système sans activité, et une panne
 * ressemble à une matinée calme.
 */
export type Etat<T> =
  | { statut: "chargement" }
  /** `rafraichit` : la donnée affichée est la précédente, une neuve est en vol. */
  | { statut: "pret"; donnees: T; rafraichit: boolean }
  | { statut: "echec"; code: CleCode };

export type Ressource<T> = Etat<T> & { recharger: () => void };

/**
 * `garderAncien` : pendant un rechargement, continuer d'afficher la donnée
 * précédente au lieu de repasser par l'état d'attente.
 *
 * Ce n'est pas un confort. Une liste qui se vide à chaque frappe démonte son
 * champ de recherche, qui perd son contenu : on tape « awa », le serveur reçoit
 * « a », et l'écran redevient vide entre chaque lettre.
 *
 * Il faut le demander, et une fiche ne le demande pas : afficher le compte
 * précédent en attendant le suivant montrerait les chiffres de quelqu'un
 * d'autre sous le nom qu'on vient d'ouvrir.
 */
export function useRessource<T>(
  charger: () => Promise<T>,
  cles: readonly unknown[],
  options: { garderAncien?: boolean } = {},
): Ressource<T> {
  const [etat, setEtat] = useState<Etat<T>>({ statut: "chargement" });
  const [tour, setTour] = useState(0);

  // La fonction de chargement est recréée à chaque rendu par l'appelant ; la
  // suivre en dépendance relancerait l'appel en boucle. Ce sont les clés qui
  // décident quand recharger, et elles seules.
  const charge = useRef(charger);
  charge.current = charger;
  const garderAncien = useRef(options.garderAncien === true);
  garderAncien.current = options.garderAncien === true;

  useEffect(() => {
    // Un composant démonté pendant l'appel — on change de section, l'appel est
    // encore en vol — ne doit pas recevoir sa réponse : React signalerait une
    // mise à jour hors de l'arbre, et surtout l'écran suivant afficherait les
    // données du précédent.
    let vivant = true;
    setEtat((precedent) => (
      garderAncien.current && precedent.statut === "pret"
        ? { ...precedent, rafraichit: true }
        : { statut: "chargement" }
    ));
    charge.current()
      .then((donnees) => {
        if (vivant) setEtat({ statut: "pret", donnees, rafraichit: false });
      })
      .catch((echec: unknown) => {
        if (!vivant) return;
        setEtat({
          statut: "echec",
          code: echec instanceof ErreurApi ? codeConnu(echec.code) : "internal_error",
        });
      });
    return () => { vivant = false; };
    // Les clés, et le tour de rechargement. Volontairement pas `charger` : la
    // fonction est recréée à chaque rendu par l'appelant, la suivre relancerait
    // l'appel en boucle. C'est `charge.current` qui porte la version fraîche.
  }, [...cles, tour]);

  const recharger = useCallback(() => setTour((t) => t + 1), []);

  return { ...etat, recharger };
}

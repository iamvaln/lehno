import type { ReactNode } from "react";
import { Button } from "../base/index.js";
import { EmptyState } from "./EmptyState.js";
import type { Ressource as EtatRessource } from "../../api/hooks.js";
import type { Messages } from "../../i18n/index.js";

/**
 * Rend les trois états d'une ressource, pour qu'aucun écran n'ait à s'en
 * souvenir.
 *
 * L'état d'échec est le seul qui compte vraiment ici : un écran vide dit « tout
 * va bien », et une panne rendue vide ressemble à une matinée calme. Le message
 * vient du dictionnaire, jamais du serveur — le sien est destiné au journal et
 * cite des identifiants internes.
 */
export function Ressource<T>(
  { etat, t, enfant }: { etat: EtatRessource<T>; t: Messages; enfant: (donnees: T) => ReactNode },
): ReactNode {
  if (etat.statut === "chargement") {
    // Une région vivante : le changement d'état est annoncé, sinon un lecteur
    // d'écran reste sur la page précédente sans savoir que celle-ci travaille.
    return (
      <div className="admin-ressource-attente" role="status" aria-live="polite">
        {t.actions.chargement}
      </div>
    );
  }

  if (etat.statut === "echec") {
    return (
      <div role="alert">
        <EmptyState
          titre={t.actions.echecTitre}
          texte={t.echecs.chargement}
          action={<Button variant="outline" onClick={etat.recharger}>{t.actions.reessayer}</Button>}
        />
      </div>
    );
  }

  // Rendu sans conteneur qui change : ce qui compte ici est que l'enfant ne
  // soit pas démonté entre deux pages, sans quoi il perdrait son état — le
  // contenu de son champ de recherche, par exemple.
  return (
    <>
      <div className="admin-ressource-rafraichit" role="status" aria-live="polite">
        {etat.rafraichit ? t.actions.chargement : ""}
      </div>
      {enfant(etat.donnees)}
    </>
  );
}

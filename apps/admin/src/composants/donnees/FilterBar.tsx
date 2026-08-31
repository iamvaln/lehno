import type { ChangeEvent, ReactNode } from "react";
import { Icon } from "../base/Icon.js";

export interface FiltreSelect {
  cle: string;
  /** Nom accessible du sélecteur : il n'a pas d'étiquette visible. */
  label: string;
  valeur: string;
  options: { value: string; label: string }[];
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
}

export interface FilterBarProps {
  /**
   * La recherche est **facultative**. Toutes les listes ne s'interrogent pas
   * par du texte libre : les paiements se filtrent par état, période,
   * utilisateur et moyen, et rien d'autre (ux-admin §5.4). Une boîte de
   * recherche qui ne cherche rien est pire que pas de boîte — elle promet un
   * geste que la page ne sait pas faire.
   */
  recherche?: string;
  onRecherche?: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  filtres?: FiltreSelect[];
  /** Compte de résultats, aligné à droite. Déjà formulé par l'appelant. */
  resultats?: ReactNode;
  /** Remise à zéro des filtres — n'apparaît que si on la fournit. */
  onReinitialiser?: () => void;
  reinitialiser?: string;
}

/** Filtres d'une page de liste : une recherche, des sélecteurs, un compte. Le
 *  composant ne filtre rien — il remonte les gestes, la page interroge. */
export function FilterBar({
  recherche,
  onRecherche,
  placeholder,
  filtres = [],
  resultats,
  onReinitialiser,
  reinitialiser,
}: FilterBarProps) {
  return (
    <div className="admin-filtres">
      {onRecherche ? (
        <label className="admin-champ admin-recherche">
          <Icon name="search" size={15} />
          <input type="search" value={recherche ?? ""} onChange={onRecherche} placeholder={placeholder} />
        </label>
      ) : null}

      {filtres.map((filtre) => (
        <select
          key={filtre.cle}
          className="admin-champ admin-focus"
          value={filtre.valeur}
          onChange={filtre.onChange}
          aria-label={filtre.label}
        >
          {filtre.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ))}

      {onReinitialiser ? (
        <button type="button" className="admin-reinit admin-focus" onClick={onReinitialiser}>
          {reinitialiser}
        </button>
      ) : null}

      {resultats != null ? <span className="admin-resultats">{resultats}</span> : null}
    </div>
  );
}

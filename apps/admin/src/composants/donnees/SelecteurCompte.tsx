import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Icon } from "../base/Icon.js";

/** Un compte tel que le sélecteur le montre. Le solde en fait partie : c'est ce
 *  qui permet de voir qu'on s'est trompé de personne avant d'écrire. */
export interface CompteChoisi {
  id: string;
  pseudo: string;
  email: string;
  solde: number;
}

export interface LibellesSelecteurCompte {
  /** Nom accessible du champ de recherche : il n'a pas d'étiquette visible. */
  chercher: string;
  placeholder: string;
  aucun: string;
  solde: string;
  changer: string;
}

export interface SelecteurCompteProps {
  comptes: CompteChoisi[];
  valeur: CompteChoisi | null;
  onChoisir: (compte: CompteChoisi | null) => void;
  /** Remonte ce qui est tapé : c'est l'appelant qui interroge le serveur. */
  onChercher?: (terme: string) => void;
  libelles: LibellesSelecteurCompte;
  id?: string;
  disabled?: boolean;
}

/**
 * Choisir un compte, jamais le taper.
 *
 * **Un compte ne se tape pas.** Sur un écran qui écrit de l'argent, la frappe
 * libre laisse partir un crédit vers une adresse voisine : « valentine@ » et
 * « valentin@ » se ressemblent, et rien ne dit ensuite lequel a été servi. Le
 * champ cherche donc parmi les comptes existants et ne rend qu'un compte réel.
 *
 * **La valeur n'existe qu'après le choix.** Tant que rien n'est retenu, le
 * formulaire n'a pas de compte — ce qui est écrit dans la boîte ne vaut pas
 * sélection, et le geste reste fermé.
 *
 * **Le compte retenu remplace la recherche** : on ne cherche plus, on vérifie.
 * Il paraît avec son pseudo, son adresse et son solde — la dernière occasion de
 * s'apercevoir de l'erreur.
 *
 * Aucune chaîne ici : les libellés arrivent par `libelles`, comme partout.
 */
export function SelecteurCompte({
  comptes, valeur, onChoisir, onChercher, libelles, id, disabled = false,
}: SelecteurCompteProps): ReactElement {
  const [terme, setTerme] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [survol, setSurvol] = useState(0);
  const cadre = useRef<HTMLDivElement>(null);

  // Cliquer ailleurs referme : une liste restée ouverte recouvre le champ
  // suivant, et on saisit un montant sans voir où il va.
  useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (e: MouseEvent): void => {
      if (cadre.current && !cadre.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [ouvert]);

  const retenir = (compte: CompteChoisi): void => {
    onChoisir(compte);
    setTerme("");
    setOuvert(false);
    setSurvol(0);
  };

  if (valeur) {
    return (
      <div className="selecteur-compte-retenu" style={RETENU}>
        <span style={{ display: "grid", gap: "var(--space-2)", minWidth: 0, flex: 1 }}>
          <strong style={{ fontSize: "var(--text-body-s)", fontWeight: "var(--font-body-bold)" }}>
            {valeur.pseudo}
          </strong>
          <span style={SECONDAIRE}>
            {valeur.email} · {libelles.solde} {valeur.solde}
          </span>
        </span>
        {disabled ? null : (
          <button
            type="button"
            className="admin-focus"
            onClick={() => onChoisir(null)}
            style={CHANGER}
          >
            <Icon name="pencil-line" size={13} />
            {libelles.changer}
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={cadre} style={{ position: "relative", maxWidth: 420 }}>
      <div style={{ ...CHAMP, opacity: disabled ? 0.55 : 1 }}>
        <Icon name="search" size={15} />
        <input
          id={id}
          value={terme}
          disabled={disabled}
          role="combobox"
          aria-expanded={ouvert}
          aria-autocomplete="list"
          aria-label={libelles.chercher}
          placeholder={libelles.placeholder}
          className="admin-focus"
          onChange={(e) => {
            setTerme(e.target.value);
            setOuvert(true);
            setSurvol(0);
            onChercher?.(e.target.value);
          }}
          onFocus={() => setOuvert(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOuvert(true);
              setSurvol((i) => Math.min(i + 1, comptes.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSurvol((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && ouvert) {
              e.preventDefault();
              const vise = comptes[survol];
              if (vise) retenir(vise);
            } else if (e.key === "Escape") {
              setOuvert(false);
            }
          }}
          style={SAISIE}
        />
      </div>

      {ouvert && !disabled ? (
        <ul role="listbox" style={LISTE}>
          {comptes.length === 0 ? (
            <li style={{ padding: "var(--space-10)", ...SECONDAIRE }}>{libelles.aucun}</li>
          ) : comptes.map((compte, rang) => (
            // `option` porte sur le BOUTON, pas sur le `li` : l'option est ce
            // qu'on active. Posée sur l'enveloppe, elle annonce un choix que le
            // clic ne déclenche pas — un lecteur d'écran promet alors un geste
            // qui n'existe pas, et le test l'a montré avant l'utilisateur.
            <li key={compte.id}>
              <button
                type="button"
                role="option"
                aria-selected={rang === survol}
                className="admin-focus"
                onMouseEnter={() => setSurvol(rang)}
                onClick={() => retenir(compte)}
                style={OPTION(rang === survol)}
              >
                <strong style={{ fontSize: "var(--text-body-s)" }}>{compte.pseudo}</strong>
                <span style={SECONDAIRE}>
                  {compte.email} · {libelles.solde} {compte.solde}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const SECONDAIRE: CSSProperties = {
  fontSize: "var(--text-mention-s)",
  color: "var(--text-mention)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const RETENU: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-12)",
  flexWrap: "wrap",
  maxWidth: 420,
  padding: "var(--space-10) var(--space-12)",
  borderRadius: "var(--radius-md)",
  border: "var(--border-width) solid var(--action)",
  background: "var(--action-quiet-bg)",
};

const CHANGER: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  flex: "none",
  minHeight: 32,
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-4)",
  padding: "0 var(--space-4)",
  fontSize: "var(--text-mention-s)",
  fontWeight: "var(--font-body-semibold)",
  color: "var(--text-accent)",
};

const CHAMP: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-8)",
  border: "var(--border-width) solid var(--border-object)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-page)",
  padding: "0 var(--space-10)",
  height: 38,
};

const SAISIE: CSSProperties = {
  all: "unset",
  flex: 1,
  minWidth: 0,
  height: "100%",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-body-s)",
  color: "var(--text-body)",
};

const LISTE: CSSProperties = {
  position: "absolute",
  zIndex: 20,
  top: "calc(100% + var(--space-4))",
  left: 0,
  right: 0,
  margin: 0,
  padding: "var(--space-4)",
  listStyle: "none",
  maxHeight: 236,
  overflowY: "auto",
  border: "var(--border-width) solid var(--border-object)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface-card)",
};

const OPTION = (survole: boolean): CSSProperties => ({
  all: "unset",
  boxSizing: "border-box",
  cursor: "pointer",
  width: "100%",
  display: "grid",
  gap: "var(--space-2)",
  padding: "var(--space-8) var(--space-10)",
  minHeight: 40,
  borderRadius: "var(--radius-sm)",
  background: survole ? "var(--action-quiet-bg)" : "transparent",
});

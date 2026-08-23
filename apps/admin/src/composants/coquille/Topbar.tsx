import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import { Icon } from "../base/Icon.js";

export type LangueOutil = "fr" | "en";

export interface TopbarProps {
  /** Recherche globale : utilisateur, paiement ou contenu, depuis n'importe où. */
  onSearch?: (e: ChangeEvent<HTMLInputElement>) => void;
  valeur?: string;
  compte?: string;
  /** Gouverne le contenu du menu de compte : l'accès aux administrateurs est réservé à `admin`. */
  role?: "support" | "admin";
  /** Ouvre la gestion des accès des administrateurs. */
  onAcces?: () => void;
  /** Ouvre « Mon profil » : le compte connecté, son rôle, ses sessions. */
  onProfil?: () => void;
  onDeconnexion?: () => void;
  /** Langue de l'outil. Le back-office se lit dans les deux langues du produit. */
  langue?: LangueOutil;
  onLangue?: (langue: LangueOutil) => void;
  /** Libellés de la barre : recherche, langue, rôles, accès, déconnexion, et les
   *  noms accessibles des boutons — `menu`, `theme`, et `compte` en secours
   *  quand aucune adresse n'est connue. */
  t?: Record<string, string>;
  onTheme?: () => void;
  nuit?: boolean;
  /** Ouvre la barre latérale sous 900 px. Le bouton est masqué au-dessus. */
  onMenu?: () => void;
}

// Deux codes, pas deux libellés : « fr » et « en » se lisent dans les deux
// langues, et les traduire les rendrait moins reconnaissables.
const LANGUES: LangueOutil[] = ["fr", "en"];

const ETAT = "var(--duration-state) var(--ease-state)";

const BARRE: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  height: "var(--topbar-height)",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-12)",
  padding: "0 var(--space-24)",
  background: "var(--surface-chrome)",
  borderBottom: "var(--border-width) solid var(--border-hairline)",
};

// Les boutons à icône de la barre : même gabarit, la réaction au survol vit en
// CSS (coquille.css, .coquille-outil). L'affichage n'est pas posé ici : celui du
// bouton de menu dépend de la largeur de la fenêtre, et un style en ligne ne se
// laisse pas reprendre par une requête média sans « !important ».
const OUTIL: CSSProperties = {
  all: "unset",
  boxSizing: "border-box",
  cursor: "pointer",
  placeItems: "center",
  width: "var(--space-32)",
  height: "var(--space-32)",
  flex: "none",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-secondary)",
  transition: `background ${ETAT}, color ${ETAT}`,
};

const OUTIL_ICONE: CSSProperties = { ...OUTIL, display: "grid" };

const RECHERCHE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-8)",
  flex: "0 1 380px",
  border: "var(--border-width) solid var(--border-object)",
  borderRadius: "var(--radius-sm)",
  padding: "0 var(--space-10)",
  height: "var(--control-height)",
  background: "var(--surface-page)",
};

const CHAMP: CSSProperties = {
  all: "unset",
  flex: 1,
  minWidth: 0,
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-body-s)",
  color: "var(--text-body)",
};

const AVATAR: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: "var(--space-24)",
  height: "var(--space-24)",
  flex: "none",
  borderRadius: "var(--radius-pill)",
  background: "var(--surface-panel)",
  border: "var(--border-width) solid var(--border-hairline)",
  fontSize: "var(--text-mention-s)",
  fontWeight: "var(--font-body-bold)",
  color: "var(--text-body)",
  textTransform: "uppercase",
};

// Le menu ne porte pas d'ombre : dans ce système, la profondeur vient du filet
// d'un pixel et de la surface qui change — c'est vrai du produit comme de l'outil.
const MENU: CSSProperties = {
  position: "absolute",
  top: "calc(100% + var(--space-6))",
  right: 0,
  minWidth: "216px",
  background: "var(--surface-chrome)",
  border: "var(--border-width) solid var(--border-object)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-6) 0",
  zIndex: 30,
};

const FILET: CSSProperties = {
  height: "var(--border-width)",
  background: "var(--border-hairline)",
  margin: "var(--space-4) 0",
};

function styleEntree(danger?: boolean): CSSProperties {
  return {
    all: "unset",
    boxSizing: "border-box",
    cursor: "pointer",
    display: "block",
    width: "100%",
    padding: "0 var(--space-12)",
    minHeight: "var(--space-32)",
    lineHeight: "var(--space-32)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-body-s)",
    color: danger ? "var(--feedback-error)" : "var(--text-body)",
    transition: `background ${ETAT}`,
  };
}

function styleLangue(choisie: boolean): CSSProperties {
  return {
    all: "unset",
    boxSizing: "border-box",
    cursor: "pointer",
    minWidth: "var(--space-32)",
    minHeight: "var(--space-24)",
    padding: "0 var(--space-8)",
    textAlign: "center",
    borderRadius: "var(--radius-sm)",
    border: `var(--border-width) solid ${choisie ? "transparent" : "var(--border-object)"}`,
    background: choisie ? "var(--action)" : "transparent",
    color: choisie ? "var(--text-on-accent)" : "var(--text-secondary)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-body-xs)",
    fontWeight: "var(--font-body-semibold)",
    textTransform: "uppercase",
    transition: `background ${ETAT}, color ${ETAT}, border-color ${ETAT}`,
  };
}

// Barre haute : recherche globale, thème, et le compte connecté — qui est un
// menu, pas une étiquette : c'est la seule sortie de l'outil, et l'entrée vers
// les accès des administrateurs, réservée au rôle admin. Réservée veut dire
// absente, pas grisée : une entrée grise dirait au support qu'il lui manque un
// droit, et l'inviterait à le demander.
export function Topbar({
  onSearch, valeur = "", compte = "", role = "support",
  langue = "fr", onLangue, t = {}, onTheme, nuit, onMenu,
  onProfil, onAcces, onDeconnexion,
}: TopbarProps) {
  const [ouvert, setOuvert] = useState(false);
  const ancre = useRef<HTMLDivElement>(null);

  // Un menu qui ne se referme qu'en cliquant son propre bouton piège la souris :
  // le clic à côté et la touche d'échappement sont les deux sorties attendues.
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (ancre.current && !ancre.current.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("pointerdown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  const entree = (label: string | undefined, onClick?: () => void, danger?: boolean): ReactNode => (
    <button
      type="button"
      className="coquille-entree"
      onClick={() => { setOuvert(false); if (onClick) onClick(); }}
      style={styleEntree(danger)}
    >
      {label}
    </button>
  );

  return (
    <header className="coquille-barre" style={BARRE}>
      <button
        type="button"
        className="coquille-burger coquille-outil"
        onClick={onMenu}
        aria-label={t.menu}
        style={{ ...OUTIL, marginLeft: "calc(var(--space-4) * -1)" }}
      >
        <Icon name="menu" size={17} />
      </button>

      <label className="coquille-recherche" style={RECHERCHE}>
        <Icon name="search" size={15} color="var(--text-mention)" />
        {/* Sans gestionnaire, le champ est en lecture seule et le dit : un
            champ contrôlé sans onChange serait muet et laisserait React
            avertir à chaque rendu. */}
        <input
          value={valeur}
          onChange={onSearch}
          readOnly={!onSearch}
          placeholder={t.recherche}
          style={CHAMP}
        />
      </label>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-10)" }}>
        <button type="button" className="coquille-outil" onClick={onTheme} aria-label={t.theme} style={OUTIL_ICONE}>
          <Icon name={nuit ? "sun" : "moon"} size={17} />
        </button>

        <div ref={ancre} style={{ position: "relative" }}>
          <button
            type="button"
            className="coquille-compte-bouton coquille-outil"
            onClick={() => setOuvert((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={ouvert}
            aria-label={compte || t.compte}
            style={{
              ...OUTIL,
              display: "flex",
              alignItems: "center",
              gap: "var(--space-8)",
              width: "auto",
              height: "var(--control-height)",
              padding: "0 var(--space-8)",
              border: `var(--border-width) solid ${ouvert ? "var(--border-object)" : "transparent"}`,
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-s)",
            }}
          >
            <span style={AVATAR}>{compte.slice(0, 1)}</span>
            <span className="coquille-compte">{compte}</span>
            <Icon name="chevron-down" size={15} />
          </button>

          {ouvert ? (
            <div role="menu" className="coquille-menu" style={MENU}>
              <div style={{ padding: "var(--space-4) var(--space-12) var(--space-8)" }}>
                <div style={{ fontSize: "var(--text-body-s)", color: "var(--text-body)" }}>{compte}</div>
                <div style={{ fontSize: "var(--text-mention-s)", color: "var(--text-mention)" }}>
                  {role === "admin" ? t.roleAdmin : t.roleSupport}
                </div>
              </div>

              <div style={FILET} />

              <div style={{
                display: "flex", alignItems: "center", gap: "var(--space-8)",
                padding: "var(--space-2) var(--space-12) var(--space-6)",
                fontSize: "var(--text-body-s)", color: "var(--text-secondary)",
              }}>
                <span style={{ flex: 1 }}>{t.langue}</span>
                <div style={{ display: "flex", gap: "var(--space-4)" }}>
                  {LANGUES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      className="coquille-langue"
                      onClick={() => { if (onLangue) onLangue(code); }}
                      aria-pressed={langue === code}
                      style={styleLangue(langue === code)}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              <div style={FILET} />

              {entree(t.profil, onProfil)}
              {role === "admin" ? entree(t.acces, onAcces) : null}
              {entree(t.deconnexion, onDeconnexion, true)}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "../base/Icon.js";

export interface SidebarItem {
  id: string;
  label: string;
  /** Nom Lucide. */
  icon: string;
  /** « alerte » pose un point : un délai court. Les chiffres restent au tableau de bord. */
  ton?: "alerte";
  /**
   * Les écrans d'une section. Présents, l'entrée **ouvre au lieu de mener** :
   * elle ne désigne aucun écran, donc le clic ne change pas de page.
   *
   * Une section ne se crée que lorsqu'elle a plusieurs écrans à porter : un
   * accordéon à un seul enfant ajoute un geste sans rien ranger.
   */
  enfants?: SidebarItem[];
}

export interface SidebarFamille {
  /** Sans titre, la famille s'affiche sans en-tête : c'est la place du tableau de bord. */
  titre?: string | null;
  items: SidebarItem[];
}

export interface SidebarProps {
  /** Rangées par ce que l'administrateur vient faire : à traiter, finances, gestion, suivi, outils. */
  familles: SidebarFamille[];
  /** Nom de l'outil, à côté de la pastille. Il vient du dictionnaire, comme le reste. */
  marque: string;
  active?: string;
  onSelect?: (id: string) => void;
  /** Affiché en pastille — le rôle conditionne ce que l'interface expose. */
  role?: "support" | "admin";
}

// Le point d'alerte : six pixels, jamais un chiffre. Un compteur dans la
// navigation promet une exactitude qu'elle ne tient pas — les nombres sont au
// tableau de bord, où ils ont leur contexte. Ici, on dit seulement « il y a
// quelque chose ». La valeur est nommée parce que le test la vérifie.
const POINT_ALERTE = 6;

// c'est le palier du favicon, dessiné pour cette taille.
// Le verrouillage ne descend pas sous 120 px (charte). La barre latérale en fait
// 232 : 132 laisse respirer la pastille de rôle à côté.
const LARGEUR_MARQUE = 132;

const NAV: CSSProperties = { padding: "var(--space-14) var(--space-10) var(--space-24)" };

// La marque ne se rétrécit pas pour faire tenir l'étiquette de rôle : elle a un
// plancher de 120 px à la charte, et un logotype comprimé est un logotype abîmé.
// C'est l'étiquette qui passe à la ligne quand la place manque.
const ENTETE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "var(--space-8) var(--space-10)",
  padding: "0 var(--space-8) var(--space-16)",
};

const ROLE: CSSProperties = {
  fontSize: "var(--text-kicker)",
  fontWeight: "var(--font-body-bold)",
  letterSpacing: "var(--tracking-kicker)",
  textTransform: "uppercase",
  color: "var(--text-mention)",
  border: "var(--border-width) solid var(--border-object)",
  borderRadius: "var(--radius-pill)",
  padding: "var(--space-2) var(--space-6)",
};

const TITRE_FAMILLE: CSSProperties = {
  fontSize: "var(--text-kicker)",
  fontWeight: "var(--font-body-bold)",
  letterSpacing: "var(--tracking-kicker)",
  textTransform: "uppercase",
  color: "var(--text-mention)",
  padding: "0 var(--space-8) var(--space-6)",
};

const ETAT = "var(--duration-state) var(--ease-state)";

/* `dedans` : l'intitulé d'une section qui contient l'écran courant. Il n'est pas
   ACTIF — il ne mène nulle part —, mais il se distingue : sans ça, une section
   repliée et une section dont on lit un écran auraient la même voix. */
function styleItem(actif: boolean, dedans = false): CSSProperties {
  return {
    all: "unset",
    boxSizing: "border-box",
    cursor: "pointer",
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "var(--space-10)",
    padding: "var(--space-6) var(--space-8)",
    borderRadius: "var(--radius-sm)",
    marginBottom: "var(--space-2)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-body-s)",
    fontWeight: actif || dedans ? "var(--font-body-semibold)" : "var(--font-body-regular)",
    background: actif ? "var(--action-quiet-bg)" : "transparent",
    color: actif ? "var(--text-accent)" : dedans ? "var(--text-body)" : "var(--text-secondary)",
    transition: `background ${ETAT}, color ${ETAT}`,
  };
}

/* Les enfants s'alignent sur le libellé du parent, sous un filet qui les
   rattache : décalés sans filet, ils flotteraient sans qu'on voie à quoi. */
const ENFANTS: CSSProperties = {
  marginLeft: "var(--space-16)",
  paddingLeft: "var(--space-10)",
  borderLeft: "1px solid var(--border-hairline)",
};

const POINT: CSSProperties = {
  flex: "0 0 auto",
  width: POINT_ALERTE,
  height: POINT_ALERTE,
  borderRadius: "var(--radius-pill)",
  background: "var(--feedback-error)",
};

// Navigation latérale. Une famille sans titre s'affiche sans en-tête : c'est
// ainsi que le tableau de bord se pose au-dessus des familles — c'est l'accueil,
// pas une tâche. L'ordre des familles est celui du tableau reçu : il porte une
// décision (à traiter d'abord, outils en dernier) qui appartient à l'appelant.
export function Sidebar({ familles, marque, active, onSelect, role }: SidebarProps) {
  return (
    <nav className="coquille-nav" style={NAV}>
      <div style={ENTETE}>
        {/* Le verrouillage horizontal — signe et mot en un seul fichier, tel que
            la charte le livre. Le mot n'est pas composé : c'est un tracé vectorisé
            de Fraunces, que la police de l'outil ne saurait pas reproduire. Les
            deux versions sont rendues, le thème posé sur <body> en cache une —
            même procédé que les bascules du produit, et aucun scintillement. */}
        <img
          className="si-clair coquille-marque"
          src="/brand/lehno-verrouillage-horizontal.svg"
          alt={marque}
          width={LARGEUR_MARQUE}
        />
        <img
          className="si-sombre coquille-marque"
          src="/brand/lehno-verrouillage-horizontal-blanc.svg"
          alt={marque}
          width={LARGEUR_MARQUE}
        />
        {role ? <span className="coquille-role" style={ROLE}>{role}</span> : null}
      </div>

      {familles.map((famille, rang) => (
        <div
          key={famille.titre ?? `famille-${rang}`}
          className="coquille-famille"
          style={{ marginBottom: famille.titre ? "var(--space-16)" : "var(--space-10)" }}
        >
          {famille.titre ? (
            <div className="coquille-famille-titre" style={TITRE_FAMILLE}>{famille.titre}</div>
          ) : null}

          {famille.items.map((item) => (
            item.enfants && item.enfants.length > 0 ? (
              <Section key={item.id} item={item} active={active} {...(onSelect ? { onSelect } : {})} />
            ) : (
              <Entree key={item.id} item={item} active={active} {...(onSelect ? { onSelect } : {})} />
            )
          ))}
        </div>
      ))}
    </nav>
  );
}

/**
 * Une section et ses écrans.
 *
 * **Elle s'ouvre d'elle-même quand l'écran courant est dedans**, et le reste :
 * sans ça, arriver sur un écran par un autre chemin — un chiffre du tableau de
 * bord, un retour d'historique — le montrerait replié, et la barre ne dirait
 * plus où l'on est.
 *
 * L'intitulé n'est pas un lien : il n'a pas d'écran à lui. Le rendre cliquable
 * vers « le premier de ses enfants » ferait deux entrées pour un même écran, et
 * la seconde changerait de destination le jour où l'ordre change.
 */
function Section({ item, active, onSelect }: {
  item: SidebarItem;
  active?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const dedans = (item.enfants ?? []).some((e) => e.id === active);
  const [ouvert, setOuvert] = useState(dedans);
  useEffect(() => { if (dedans) setOuvert(true); }, [dedans]);
  const idListe = `nav-${item.id}`;

  return (
    <div className="coquille-section">
      <button
        type="button"
        className="coquille-item"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-controls={idListe}
        style={styleItem(false, dedans)}
      >
        <Icon name={item.icon} size={17} />
        <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
        {item.ton === "alerte" ? (
          <span data-ton="alerte" aria-hidden="true" style={POINT} />
        ) : null}
        <Icon name={ouvert ? "chevron-down" : "chevron-right"} size={14} />
      </button>
      {ouvert ? (
        <div id={idListe} className="coquille-enfants" style={ENFANTS}>
          {item.enfants?.map((enfant) => (
            <Entree key={enfant.id} item={enfant} active={active} {...(onSelect ? { onSelect } : {})} sansIcone />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Entree({ item, active, onSelect, sansIcone }: {
  item: SidebarItem;
  active?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
  sansIcone?: boolean;
}) {
  const actif = item.id === active;
  return (
    <button
      type="button"
      className="coquille-item"
      onClick={onSelect ? () => onSelect(item.id) : undefined}
      aria-current={actif ? "page" : undefined}
      style={styleItem(actif)}
    >
      {sansIcone ? null : <Icon name={item.icon} size={17} />}
      <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
      {item.ton === "alerte" ? (
        <span data-ton="alerte" aria-hidden="true" style={POINT} />
      ) : null}
    </button>
  );
}

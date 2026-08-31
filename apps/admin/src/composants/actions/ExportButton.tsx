import { useEffect, useRef, useState } from "react";
import { Button } from "../base/Button.js";
import { Icon } from "../base/Icon.js";

export interface LibellesExport {
  exporter?: string;
  /** Gabarit « Exporter {portee} ». */
  avecPortee?: string;
  /** L'export se prépare — le fichier n'est pas encore là. */
  encours?: string;
  /** Nom lisible de chaque format, par clé. */
  formats?: Record<string, string>;
  /** Rappel que l'export est journalisé : qui a sorti quoi. */
  journal?: string;
}

export interface ExportButtonProps {
  /** Un seul format exporte au clic ; plusieurs ouvrent un menu. */
  formats?: string[];
  /** Ce que l'export emporte, déjà formulé : « 12 comptes sélectionnés ». */
  portee?: string;
  libelles?: LibellesExport;
  /** encours affiche la préparation à la place du bouton. */
  etat?: "encours";
  onExport: (format: string) => void;
  disabled?: boolean;
}

const GABARIT = "{portee}";

/** Sortie de données. L'export **dit ce qu'il emporte** — la sélection, les
 *  résultats filtrés, ou tout : sortir douze mille comptes au lieu de douze n'est
 *  pas le même geste, et sans la portée personne ne sait lequel il fait. Il se
 *  journalise comme une action sensible (§7) ; l'accusé se fait au `Toast`. */
export function ExportButton({
  formats = ["csv"],
  portee,
  libelles = {},
  etat,
  onExport,
  disabled = false,
}: ExportButtonProps) {
  const [ouvert, setOuvert] = useState(false);
  const ancre = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const hors = (e: MouseEvent) => {
      if (ancre.current && !ancre.current.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", hors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", hors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  // Un export se prépare : le bouton cède la place à son état, plutôt que de
  // rester cliquable et de laisser lancer le même travail trois fois.
  if (etat === "encours") {
    return (
      <span className="admin-export-encours">
        <Icon name="loader" size={15} />
        <span>{libelles.encours}</span>
      </span>
    );
  }

  const multiple = formats.length > 1;
  const libelle = portee && libelles.avecPortee ? libelles.avecPortee.replace(GABARIT, portee) : libelles.exporter;

  return (
    <span className="admin-export" ref={ancre}>
      <Button
        variant="outline"
        icon="download"
        disabled={disabled}
        aria-haspopup={multiple ? "menu" : undefined}
        aria-expanded={multiple ? ouvert : undefined}
        onClick={() => (multiple ? setOuvert((v) => !v) : onExport(formats[0]!))}
      >
        {libelle}
      </Button>

      {ouvert ? (
        // Le rappel de journalisation vit **hors** du role="menu". Un menu
        // n'admet que des menuitem : un lecteur d'écran saute ce qu'il ne
        // reconnaît pas, et le compte qu'il annonce — « 1 sur 3 » — devient
        // faux dès qu'on glisse autre chose entre les entrées. Le rappel reste
        // affiché et lu, il n'est simplement plus compté comme un choix.
        <div className="admin-export-panneau">
          <div className="admin-export-menu" role="menu">
            {formats.map((format) => (
              <button
                key={format}
                type="button"
                role="menuitem"
                className="admin-export-item admin-focus"
                onClick={() => {
                  setOuvert(false);
                  onExport(format);
                }}
              >
                {libelles.formats?.[format] ?? format.toUpperCase()}
              </button>
            ))}
          </div>
          {libelles.journal ? <p className="admin-export-journal">{libelles.journal}</p> : null}
        </div>
      ) : null}
    </span>
  );
}

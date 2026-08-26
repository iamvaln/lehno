import type { ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { DataTable, EmptyState, FilterBar, Pagination, type Colonne, type FiltreSelect } from "../composants/donnees/index.js";
import { ExportButton } from "../composants/actions/index.js";
import { messages, type Langue } from "../i18n/index.js";

/**
 * Le gabarit des sections qui se lisent et ne s'écrivent pas — journal d'audit,
 * connexions.
 *
 * Un seul fichier pour les deux, parce qu'elles font la même chose : une page à
 * curseur, triée du plus récent au plus ancien, sans aucun geste. Ce qui les
 * distingue tient dans leurs colonnes, et les colonnes sont des données.
 *
 * **Aucune action, et c'est le sujet.** Une trace qui fait foi ne se modifie ni
 * ne s'efface : il n'existe aucun chemin d'écriture vers le journal, ni depuis
 * cet écran ni depuis ailleurs. Un menu d'actions ici serait une promesse que
 * le serveur ne tient pas — et qu'il ne doit pas tenir.
 */
export interface LectureProps<L extends { id: string }> {
  langue?: Langue;
  titre: string;
  sous: string;
  colonnes: Colonne<L>[];
  lignes: L[];
  vide: { titre: string; texte: string };
  curseurSuivant?: string | null;
  aPrecedent?: boolean;
  onPagePrecedente?: () => void;
  onPageSuivante?: () => void;
  onRetour?: (id: string) => void;

  /** Les sélecteurs de la barre. Absents, la barre ne paraît pas. */
  filtres?: FiltreSelect[];
  /** N'apparaît qu'une fois un filtre posé : un filtre oublié fait lire une
   *  liste partielle en la croyant complète. */
  onReinitialiser?: (() => void) | undefined;
  /** Absent, aucun bouton d'export — c'est ainsi qu'une section fermée à un
   *  rôle n'offre pas un geste que le serveur refuserait. */
  onExporter?: (() => void) | undefined;
  exportEnCours?: boolean;
}

export function Lecture<L extends { id: string }>({
  langue = "fr",
  titre,
  sous,
  colonnes,
  lignes,
  vide,
  curseurSuivant = null,
  aPrecedent = false,
  onPagePrecedente,
  onPageSuivante,
  onRetour,
  filtres,
  onReinitialiser,
  onExporter,
  exportEnCours = false,
}: LectureProps<L>): ReactNode {
  const t = messages(langue);

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader
        titre={titre}
        sous={sous}
        {...(onExporter
          ? {
            actions: (
              <ExportButton
                formats={["csv"]}
                onExport={() => onExporter()}
                {...(exportEnCours ? { etat: "encours" as const } : {})}
                libelles={{
                  exporter: t.exporter.bouton,
                  encours: t.exporter.encours,
                  formats: { csv: t.exporter.formatCsv },
                  journal: t.exporter.journal,
                }}
              />
            ),
          }
          : {})}
      />

      {filtres && filtres.length > 0 ? (
        <FilterBar
          filtres={filtres}
          {...(onReinitialiser
            ? { onReinitialiser, reinitialiser: t.table.reinitialiser }
            : {})}
        />
      ) : null}

      <DataTable
        colonnes={colonnes}
        lignes={lignes}
        vide={<EmptyState titre={vide.titre} texte={vide.texte} />}
      />

      {lignes.length > 0 ? (
        <Pagination
          curseurSuivant={curseurSuivant}
          aPrecedent={aPrecedent}
          onPrecedent={() => onPagePrecedente?.()}
          onSuivant={() => onPageSuivante?.()}
          libelles={{
            pagination: t.table.pagination,
            precedent: t.table.precedent,
            suivant: t.table.suivant,
            parPage: t.table.parPage,
          }}
        />
      ) : null}
    </>
  );
}

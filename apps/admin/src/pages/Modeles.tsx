import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { DataTable, EmptyState, StatusPill, type Colonne } from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { AdminRole, ModeleIa } from "@lehno/contracts";

/**
 * Le catalogue des modèles, et l'ordre dans lequel on les essaie.
 *
 * Ce que cet écran **ne montre pas** : la dépense réelle et ce qu'elle a
 * rapporté, que le §5.8 demande face à face. `AIUsage` et `ActionRun` n'existent
 * pas en base. L'écran le dit en toutes lettres plutôt que d'afficher des zéros
 * là où devrait se lire une marge — un zéro dans un calcul de marge se prend
 * pour un fait.
 */
export interface ModelesProps {
  role: AdminRole;
  langue?: Langue;
  modeles: ModeleIa[];
  onBasculer?: (modele: ModeleIa, actif: boolean, motif: string) => void;
  onRetour?: (id: string) => void;
}

export function Modeles({ role, langue = "fr", modeles, onBasculer, onRetour }: ModelesProps): ReactNode {
  const t = messages(langue);
  const [geste, setGeste] = useState<ModeleIa | null>(null);

  // Un coût absent n'est pas un coût nul : c'est un modèle qu'on n'a pas encore
  // tarifé. « 0 » le ferait passer pour gratuit.
  const cout = (valeur: number | null): string =>
    valeur === null ? t.modeles.sansCout : `${valeur} ${t.modeles.unite}`;

  const colonnes: Colonne<ModeleIa>[] = [
    { cle: "rang", titre: t.modeles.col.rang, largeur: 130 },
    { cle: "fournisseur", titre: t.modeles.col.fournisseur, largeur: 150 },
    { cle: "modele", titre: t.modeles.col.modele },
    {
      cle: "actif",
      titre: t.modeles.col.etat,
      largeur: 140,
      rendu: (m) => (
        <StatusPill ton={m.actif ? "actif" : "arrete"}>
          {m.actif ? t.modeles.etats.actif : t.modeles.etats.eteint}
        </StatusPill>
      ),
    },
    { cle: "coutEntree", titre: t.modeles.col.entree, discret: true, aligne: "right", rendu: (m) => cout(m.coutEntree) },
    { cle: "coutSortie", titre: t.modeles.col.sortie, discret: true, aligne: "right", rendu: (m) => cout(m.coutSortie) },
  ];

  const dialogue = geste?.actif === true ? t.modeles.dialogueEteindre : t.modeles.dialogueRallumer;

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: t.modeles.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader titre={t.modeles.titre} sous={t.modeles.sous} />

      <DataTable
        colonnes={colonnes}
        lignes={modeles}
        libelles={{ actions: t.table.actions }}
        // Le rôle retire : seul un administrateur touche à l'ordre d'essai.
        {...(role === "admin"
          ? {
            actions: (m: ModeleIa) => [
              { id: "basculer", label: m.actif ? t.modeles.eteindre : t.modeles.rallumer, danger: m.actif },
            ],
            onAction: (_id: string, m: ModeleIa) => setGeste(m),
          }
          : {})}
        vide={<EmptyState titre={t.modeles.titre} texte={t.modeles.sous} />}
      />

      <p className="gabarit-note">{t.modeles.manque}</p>

      {geste ? (
        <ConfirmWithReason
          destructif={geste.actif}
          titre={dialogue.titre.replace("{modele}", geste.modele)}
          consequence={dialogue.consequence}
          motifs={[...dialogue.motifs]}
          libelles={{
            motif: t.confirmation.motif,
            choisir: t.confirmation.motifManquant,
            autre: t.confirmation.autre,
            precision: t.confirmation.autrePlaceholder,
            journal: t.confirmation.motifAide,
            annuler: t.confirmation.annuler,
            confirmer: t.confirmation.confirmer,
          }}
          onAnnuler={() => setGeste(null)}
          onConfirmer={(motif) => {
            onBasculer?.(geste, !geste.actif, motif);
            setGeste(null);
          }}
        />
      ) : null}
    </>
  );
}

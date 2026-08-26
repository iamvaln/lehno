import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { DataTable, EmptyState, StatusPill, type Colonne } from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { AdminRole, DrapeauAdmin } from "@lehno/contracts";

/**
 * Les fonctionnalités, allumées et éteintes — ux-admin §5.7.
 *
 * Deux choses distinguent cet écran d'une simple liste d'interrupteurs.
 *
 * **Il montre ce qu'un drapeau couvre.** Les écrans qu'il éteint et les points
 * d'entrée qu'il ferme viennent du registre, tenu côté serveur — l'outil ne
 * recopie rien, et ne peut donc pas diverger. Un administrateur doit voir ce
 * qu'il éteint avant de basculer, sans avoir à lire le code.
 *
 * **Il annonce les conséquences avant le geste.** Éteindre le Mur emporte le
 * dépôt de vœux et la réservation. Le dire dans le dialogue, plutôt que de le
 * laisser découvrir, est la raison d'être de cet écran.
 */
export interface DrapeauxProps {
  role: AdminRole;
  langue?: Langue;
  drapeaux: DrapeauAdmin[];
  onBasculer?: (drapeau: DrapeauAdmin, actif: boolean, motif: string) => void;
  onRetour?: (id: string) => void;
}

/**
 * Le tableau identifie ses lignes par `id` ; l'identité d'un drapeau est sa
 * clé. On la recopie ici plutôt que d'ajouter au contrat un champ qui doublerait
 * `cle` — deux identifiants pour une seule chose finissent toujours par
 * diverger.
 */
type LigneDrapeau = DrapeauAdmin & { id: string };

export function Drapeaux({ role, langue = "fr", drapeaux, onBasculer, onRetour }: DrapeauxProps): ReactNode {
  const t = messages(langue);
  const [geste, setGeste] = useState<DrapeauAdmin | null>(null);
  const lignes: LigneDrapeau[] = drapeaux.map((d) => ({ ...d, id: d.cle }));

  const colonnes: Colonne<LigneDrapeau>[] = [
    { cle: "cle", titre: t.drapeaux.col.cle, largeur: 180 },
    { cle: "gouverne", titre: t.drapeaux.col.gouverne },
    {
      cle: "portee",
      titre: t.drapeaux.col.portee,
      largeur: 150,
      discret: true,
      rendu: (d) => d.portee.map((p) => t.drapeaux.portees[p]).join(" · "),
    },
    {
      cle: "ecrans",
      titre: t.drapeaux.col.couverture,
      discret: true,
      // La couverture, telle que le registre la donne. C'est elle qu'on vient
      // lire avant de basculer.
      rendu: (d) => (
        <span>
          {d.ecrans.join(" · ")}
          {d.chemins.length > 0 ? <><br />{d.chemins.join(" · ")}</> : null}
          {d.requiert.length > 0 ? (
            <><br />{t.drapeaux.requiert.replace("{cles}", d.requiert.join(", "))}</>
          ) : null}
        </span>
      ),
    },
    {
      cle: "actif",
      titre: t.drapeaux.col.etat,
      largeur: 170,
      rendu: (d) => {
        // Trois états, pas deux. « Allumé, sans effet » est le cas qu'on
        // manquerait en ne regardant que l'interrupteur : le drapeau est bien
        // allumé, mais un prérequis est éteint et personne ne voit rien.
        if (d.actif && !d.effectif) return <StatusPill ton="attente">{t.drapeaux.etats.inerte}</StatusPill>;
        return (
          <StatusPill ton={d.actif ? "actif" : "arrete"}>
            {d.actif ? t.drapeaux.etats.actif : t.drapeaux.etats.eteint}
          </StatusPill>
        );
      },
    },
    {
      cle: "parQui",
      titre: t.drapeaux.col.parQui,
      largeur: 200,
      discret: true,
      rendu: (d) => d.parQui ?? t.drapeaux.jamais,
    },
  ];

  const dialogue = geste?.actif === true ? t.drapeaux.dialogueEteindre : t.drapeaux.dialogueAllumer;
  // La cascade ne s'annonce que si elle existe, et seulement dans le sens où
  // elle se produit : allumer n'emporte rien.
  const cascade = geste?.actif === true && geste.emporte.length > 0
    ? `${t.drapeaux.emporte} : ${geste.emporte.join(", ")}.`
    : "";

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: t.drapeaux.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader titre={t.drapeaux.titre} sous={t.drapeaux.sous} />

      <DataTable
        colonnes={colonnes}
        lignes={lignes}
        libelles={{ actions: t.table.actions }}
        {...(role === "admin"
          ? {
            actions: (d: LigneDrapeau) => [
              { id: "basculer", label: d.actif ? t.drapeaux.eteindre : t.drapeaux.allumer, danger: d.actif },
            ],
            onAction: (_id: string, d: LigneDrapeau) => setGeste(d),
          }
          : {})}
        vide={<EmptyState titre={t.drapeaux.titre} texte={t.drapeaux.sous} />}
      />

      {geste ? (
        <ConfirmWithReason
          destructif={geste.actif}
          titre={dialogue.titre.replace("{cle}", geste.cle)}
          consequence={`${dialogue.consequence}${cascade ? ` ${cascade}` : ""}`}
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

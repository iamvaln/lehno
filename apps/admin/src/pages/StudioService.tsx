import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { DataTable, EmptyState, StatusPill, type Colonne } from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { AdminRole, ConfigurationPortrait, EtatPortrait } from "@lehno/contracts";

/**
 * Réglages en service — un écran de LECTURE qui répond à deux questions, et à
 * rien d'autre : qu'est-ce qui tourne, et qui l'a mis là.
 *
 * **On ne change rien ici, et l'écran le dit.** Un administrateur qui cherche où
 * modifier ne doit pas avoir à le déduire de l'absence de champs : la phrase le
 * renvoie à l'Atelier, là où les réglages se composent.
 *
 * **L'historique EST l'audit.** Publier et remettre en service sont les deux
 * seuls gestes de cette section ; une table qui les liste avec leur auteur,
 * leur date et leur motif est déjà la traçabilité exigée. La redoubler d'un
 * journal séparé ferait lire deux fois la même chose.
 *
 * **Ce que l'écran ne montre pas.** Le taux de régénération est sa mesure
 * naturelle — le seul chiffre qui dise « la publication d'hier a empiré les
 * choses ». Aucune route ne le sert : la page le dit en une ligne plutôt que
 * d'afficher un zéro, qui se prendrait pour une mesure.
 */
export interface StudioServiceProps {
  role: AdminRole;
  langue?: Langue;
  etat: EtatPortrait;
  historique: ConfigurationPortrait[];
  /** Remet une version antérieure en service. À l'appelant de l'envoyer. */
  onRevenir?: (config: ConfigurationPortrait, motif: string) => void;
  onRetour?: (id: string) => void;
}

/** Un instant serveur, rendu en date lisible. Les publications sont horodatées
 *  à la seconde ; l'heure n'apprend rien à qui relit un historique. */
function enDate(iso: string, langue: Langue): string {
  return new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(iso));
}

export function StudioService(
  { role, langue = "fr", etat, historique, onRevenir, onRetour }: StudioServiceProps,
): ReactNode {
  const t = messages(langue);
  const d = t.studioService;
  const [aRemettre, setARemettre] = useState<ConfigurationPortrait | null>(null);

  const remplir = (gabarit: string, valeurs: Record<string, string | number>): string =>
    Object.entries(valeurs).reduce((a, [c, v]) => a.split(`{${c}}`).join(String(v)), gabarit);

  const colonnes: Colonne<ConfigurationPortrait & { id: string }>[] = [
    {
      cle: "version",
      titre: d.col.version,
      rendu: (c) => (c.version === null ? "—" : remplir(d.version, { n: c.version })),
    },
    {
      cle: "publieeLe",
      titre: d.col.quand,
      rendu: (c) => (c.publieeLe === null ? "—" : enDate(c.publieeLe, langue)),
    },
    { cle: "parQui", titre: d.col.parQui, rendu: (c) => c.parQui ?? "—" },
    { cle: "note", titre: d.col.note, rendu: (c) => c.note ?? "—" },
    {
      cle: "etat",
      titre: d.col.etat,
      rendu: (c) => (
        <StatusPill ton={c.etat === "published" ? "actif" : c.etat === "draft" ? "attente" : "neutre"}>
          {d.etats[c.etat]}
        </StatusPill>
      ),
    },
  ];

  const service = etat.enService;

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: d.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader titre={d.titre} sous={d.sous} />

      {/* Rien n'a jamais été publié : l'écran le dit et renvoie à l'Atelier
          plutôt que de montrer une fiche vide. Une fiche à trous se lit comme
          une panne ; une phrase se lit comme un état. */}
      {service === null ? (
        <EmptyState titre={d.premier.titre} texte={d.premier.texte} />
      ) : (
        <section className="admin-section" role="region" aria-labelledby="studio-en-service">
          <h2 id="studio-en-service" className="admin-section-titre">{d.enService}</h2>
          <p className="admin-section-sous">
            {service.version === null ? "—" : remplir(d.version, { n: service.version })}
            {service.publieeLe === null ? null : (
              <>
                {" · "}
                {remplir(d.depuis, { date: enDate(service.publieeLe, langue) })}
                {service.parQui === null ? null : ` ${remplir(d.par, { qui: service.parQui })}`}
              </>
            )}
          </p>
          <p>{service.note ?? d.sansNote}</p>

          <h3 className="admin-section-titre">{d.contenu.titre}</h3>
          <ul>
            <li>{remplir(d.contenu.ambiances, { n: service.reglages.ambiances.length })}</li>
            <li>{remplir(d.contenu.voies, { n: service.reglages.voiesImage.length })}</li>
            <li>{remplir(d.contenu.illustration, { modele: service.reglages.modeles.illustration })}</li>
            <li>{remplir(d.contenu.photo, { modele: service.reglages.modeles.photo_style })}</li>
          </ul>

          {/* La mesure manquante, dite une fois. */}
          <p className="admin-section-sous">{d.tauxAbsent}</p>
        </section>
      )}

      <p className="admin-section-sous">{d.lecture}</p>

      <section className="admin-section" role="region" aria-labelledby="studio-historique">
        <h2 id="studio-historique" className="admin-section-titre">{d.historique.titre}</h2>
        <p className="admin-section-sous">{d.historique.sous}</p>
        <DataTable
          colonnes={colonnes}
          lignes={historique.map((c) => ({ ...c, id: c.id }))}
          libelles={{ actions: t.table.actions }}
          vide={<EmptyState titre={d.aucunePublication.titre} texte={d.aucunePublication.texte} />}
          /* Le support ne voit pas ce qu'il ne peut pas faire : la colonne
             d'actions ne s'ouvre pas pour lui. Et une version DÉJÀ en service ne
             se remet pas en service — le geste n'aurait rien à défaire. */
          actions={(c) => (
            role === "admin" && c.etat !== "published"
              ? [{ id: "revenir", label: d.revenir }]
              : []
          )}
          onAction={(id, c) => { if (id === "revenir") setARemettre(c); }}
        />
      </section>

      {aRemettre === null ? null : (
        <ConfirmWithReason
          titre={remplir(d.dialogue.titre, { n: aRemettre.version ?? 0 })}
          consequence={d.dialogue.consequence}
          motifs={[...d.dialogue.motifs]}
          libelles={{
            motif: t.confirmation.motif,
            choisir: t.confirmation.motifManquant,
            autre: t.confirmation.autre,
            precision: t.confirmation.autrePlaceholder,
            journal: t.confirmation.motifAide,
            annuler: t.confirmation.annuler,
            confirmer: t.confirmation.confirmer,
          }}
          onAnnuler={() => setARemettre(null)}
          onConfirmer={(motif) => {
            onRevenir?.(aRemettre, motif);
            setARemettre(null);
          }}
        />
      )}
    </>
  );
}

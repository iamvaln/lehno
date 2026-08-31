import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader, PageTabs } from "../composants/page/index.js";
import { DataTable, EmptyState, FilterBar, StatusPill, type Colonne, type TonPastille } from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { DemandeAssistance, MessageContact, InscriptionAttente, Retour } from "@lehno/contracts";

/**
 * Les quatre files — ux-admin §6, « répondre aux utilisateurs et traiter les
 * cas courants ».
 *
 * Trois se lisent, la quatrième se solde. La distinction se voit à l'écran :
 * seule la file des demandes porte des gestes et un filtre d'état, parce
 * qu'elle est la seule dont le modèle porte un état. Donner des gestes aux
 * trois autres promettrait un travail qu'aucune table ne saurait retenir.
 */

type Onglet = "demandes" | "contact" | "attente" | "retours";

export interface AssistanceProps {
  langue?: Langue;
  onglet?: Onglet;
  onOnglet?: (o: Onglet) => void;
  demandes?: DemandeAssistance[];
  contact?: MessageContact[];
  attente?: InscriptionAttente[];
  retours?: Retour[];
  filtreEtat?: string;
  onFiltre?: (etat: string) => void;
  onSolder?: (id: string, etat: "open" | "answered" | "closed", reason: string) => void;
  onRetour?: (id: string) => void;
}

const TON: Record<string, TonPastille> = { open: "attente", answered: "actif", closed: "neutre" };

export function Assistance({
  langue = "fr", onglet = "demandes", onOnglet,
  demandes = [], contact = [], attente = [], retours = [],
  filtreEtat = "tous", onFiltre, onSolder, onRetour,
}: AssistanceProps): ReactNode {
  const t = messages(langue);
  const [geste, setGeste] = useState<{ demande: DemandeAssistance; vers: "open" | "answered" | "closed" } | null>(null);

  const jour = (iso: string) => new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));

  const colonnesDemandes: Colonne<DemandeAssistance>[] = [
    { cle: "utilisateur", titre: t.assistance.demandes.col.utilisateur, largeur: 150 },
    { cle: "sujet", titre: t.assistance.demandes.col.sujet, largeur: 180, rendu: (d) => d.sujet ?? t.assistance.demandes.sansSujet },
    { cle: "corps", titre: t.assistance.demandes.col.corps },
    { cle: "version", titre: t.assistance.demandes.col.version, discret: true, largeur: 110, rendu: (d) => d.version ?? "" },
    {
      cle: "etat", titre: t.assistance.demandes.col.etat, largeur: 140,
      rendu: (d) => <StatusPill ton={TON[d.etat] ?? "neutre"}>{t.assistance.demandes.etats[d.etat]}</StatusPill>,
    },
    { cle: "creeLe", titre: t.assistance.demandes.col.quand, discret: true, largeur: 190, rendu: (d) => jour(d.creeLe) },
  ];

  const colonnesContact: Colonne<MessageContact>[] = [
    { cle: "nom", titre: t.assistance.contact.col.nom, largeur: 160 },
    { cle: "email", titre: t.assistance.contact.col.email, largeur: 220 },
    {
      cle: "sujet", titre: t.assistance.contact.col.sujet, largeur: 180,
      // Une clé traduite, jamais la chaîne brute : c'est ce qui rend l'outil
      // bilingue sans que le serveur connaisse la langue de qui l'appelle.
      rendu: (m) => t.assistance.contact.sujets[m.sujet as keyof typeof t.assistance.contact.sujets] ?? m.sujet,
    },
    { cle: "message", titre: t.assistance.contact.col.message },
    { cle: "creeLe", titre: t.assistance.contact.col.quand, discret: true, largeur: 190, rendu: (m) => jour(m.creeLe) },
  ];

  const colonnesAttente: Colonne<InscriptionAttente>[] = [
    { cle: "email", titre: t.assistance.attente.col.email },
    { cle: "source", titre: t.assistance.attente.col.source, largeur: 180, rendu: (i) => i.source ?? t.assistance.attente.sansSource },
    { cle: "langue", titre: t.assistance.attente.col.langue, discret: true, largeur: 110, rendu: (i) => i.langue ?? "" },
    { cle: "creeLe", titre: t.assistance.attente.col.quand, discret: true, largeur: 190, rendu: (i) => jour(i.creeLe) },
  ];

  const colonnesRetours: Colonne<Retour>[] = [
    {
      cle: "utilisateur", titre: t.assistance.retours.col.utilisateur, largeur: 170,
      // Un retour survit au compte qui l'a laissé : l'absence se dit plutôt que
      // de laisser une case vide qu'on prendrait pour un oubli.
      rendu: (r) => r.utilisateur ?? t.assistance.retours.anonyme,
    },
    { cle: "note", titre: t.assistance.retours.col.note, largeur: 100, aligne: "right", rendu: (r) => (r.note === null ? t.assistance.retours.sansNote : String(r.note)) },
    { cle: "corps", titre: t.assistance.retours.col.corps, rendu: (r) => r.corps ?? "" },
    { cle: "version", titre: t.assistance.retours.col.version, discret: true, largeur: 110, rendu: (r) => r.version ?? "" },
    { cle: "creeLe", titre: t.assistance.retours.col.quand, discret: true, largeur: 190, rendu: (r) => jour(r.creeLe) },
  ];

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: t.assistance.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader titre={t.assistance.titre} sous={t.assistance.sous} />

      <PageTabs
        actif={onglet}
        onSelect={(id) => onOnglet?.(id as Onglet)}
        onglets={[
          { id: "demandes", label: t.assistance.onglets.demandes },
          { id: "contact", label: t.assistance.onglets.contact },
          { id: "attente", label: t.assistance.onglets.attente },
          { id: "retours", label: t.assistance.onglets.retours },
        ]}
      />

      {onglet === "demandes" ? (
        <>
          <FilterBar
            filtres={[{
              cle: "etat",
              label: t.assistance.demandes.filtreEtat,
              valeur: filtreEtat,
              onChange: (e) => onFiltre?.(e.target.value),
              options: [
                { value: "tous", label: t.assistance.demandes.tous },
                ...(["open", "answered", "closed"] as const)
                  .map((e) => ({ value: e, label: t.assistance.demandes.etats[e] })),
              ],
            }]}
          />
          <DataTable
            colonnes={colonnesDemandes}
            lignes={demandes}
            libelles={{ actions: t.table.actions }}
            actions={(d: DemandeAssistance) => (d.etat === "closed"
              ? [{ id: "open", label: t.assistance.demandes.gestes.rouvrir }]
              : [
                ...(d.etat === "open" ? [{ id: "answered", label: t.assistance.demandes.gestes.repondre }] : []),
                { id: "closed", label: t.assistance.demandes.gestes.clore },
              ])}
            onAction={(vers: string, d: DemandeAssistance) =>
              setGeste({ demande: d, vers: vers as "open" | "answered" | "closed" })}
            vide={<EmptyState titre={t.assistance.demandes.vide.titre} texte={t.assistance.demandes.vide.texte} />}
          />
        </>
      ) : null}

      {/* Les trois registres : aucun geste, parce qu'aucune table ne retiendrait
          ce qu'on y ferait. */}
      {onglet === "contact" ? (
        <DataTable
          colonnes={colonnesContact}
          lignes={contact}
          vide={<EmptyState titre={t.assistance.contact.vide.titre} texte={t.assistance.contact.vide.texte} />}
        />
      ) : null}

      {onglet === "attente" ? (
        <DataTable
          colonnes={colonnesAttente}
          lignes={attente}
          vide={<EmptyState titre={t.assistance.attente.vide.titre} texte={t.assistance.attente.vide.texte} />}
        />
      ) : null}

      {onglet === "retours" ? (
        <DataTable
          colonnes={colonnesRetours}
          lignes={retours}
          vide={<EmptyState titre={t.assistance.retours.vide.titre} texte={t.assistance.retours.vide.texte} />}
        />
      ) : null}

      {geste ? (
        <ConfirmWithReason
          destructif={geste.vers === "closed"}
          titre={t.assistance.demandes.dialogue.titre}
          consequence={t.assistance.demandes.dialogue.consequence}
          motifs={[...t.assistance.demandes.dialogue.motifs]}
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
            const { demande, vers } = geste;
            setGeste(null);
            onSolder?.(demande.id, vers, motif);
          }}
        />
      ) : null}
    </>
  );
}

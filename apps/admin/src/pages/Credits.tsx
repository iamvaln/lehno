import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader, PageTabs, FormRow } from "../composants/page/index.js";
import { DataTable, EmptyState, FilterBar, StatusPill, type Colonne, type TonPastille } from "../composants/donnees/index.js";
import { ConfirmWithReason, ExportButton, RoleGate } from "../composants/actions/index.js";
import { Button } from "../composants/base/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { AdminRole, PaiementLigne, PaiementDetail, MouvementCredit, Palier, Canal, CompteCollecte } from "@lehno/contracts";

/**
 * Crédits et paiements — ux-admin §5.4.
 *
 * Trois faces d'une même chose : ce qui est entré, ce que ça a produit en
 * crédits, et les réglages qui décident de l'un et de l'autre. Ce n'est pas de
 * la navigation — la section ne change pas.
 *
 * L'écran de décision porte le rappel que **le reçu ne prouve rien**. Ce n'est
 * pas une politesse : un montage est facile, et c'est la réception sur le
 * compte de l'opérateur qui fait foi. Le rappel évite l'approbation machinale,
 * et il ne s'efface pas.
 */

type Onglet = "paiements" | "mouvements" | "reglages";

export interface CreditsProps {
  role: AdminRole;
  langue?: Langue;
  onglet?: Onglet;
  onOnglet?: (o: Onglet) => void;

  paiements?: PaiementLigne[];
  paiement?: PaiementDetail | null;
  mouvements?: MouvementCredit[];
  paliers?: Palier[];
  canaux?: Canal[];
  comptes?: CompteCollecte[];

  filtreEtat?: string;
  filtreMode?: string;
  onFiltre?: (filtres: { etat?: string; mode?: string }) => void;
  onOuvrir?: (paiement: PaiementLigne) => void;
  onRetour?: (id: string) => void;
  /** Ouvrir la saisie d'un versement. Absent, le geste n'est pas proposé —
   *  c'est ainsi que le support ne voit pas ce que le serveur lui refuse. */
  onSaisir?: (() => void) | undefined;
  /**
   * Sortir la liste de l'onglet courant. Absent, aucun bouton — même règle que
   * ci-dessus : on ne montre pas un geste que le serveur refuserait.
   *
   * L'onglet des réglages n'en a pas : ce sont des paramètres, pas une liste
   * qu'on analyse ou qu'on produit pour la conformité.
   */
  onExporter?: (() => void) | undefined;
  exportEnCours?: boolean;
  onDecider?: (decision: {
    decision: "confirmer" | "rejeter";
    montantRecu?: number;
    reference?: string;
    reason: string;
  }) => void;
}

const TON_ETAT: Record<string, TonPastille> = {
  pending: "attente", succeeded: "actif", failed: "arrete", expired: "arrete", refunded: "neutre",
};

/** Une durée lisible. Les secondes ne disent rien à qui cherche « combien de temps ». */
function duree(secondes: number): string {
  if (secondes < 60) return `${secondes} s`;
  if (secondes < 3600) return `${Math.round(secondes / 60)} min`;
  if (secondes < 86_400) return `${Math.round(secondes / 3600)} h`;
  return `${Math.round(secondes / 86_400)} j`;
}

export function Credits({
  role, langue = "fr", onglet = "paiements", onOnglet,
  paiements = [], paiement = null, mouvements = [], paliers = [], canaux = [], comptes = [],
  filtreEtat = "tous", filtreMode = "tous", onFiltre, onOuvrir, onRetour, onSaisir, onDecider,
  onExporter, exportEnCours = false,
}: CreditsProps): ReactNode {
  const t = messages(langue);
  const [montantRecu, setMontantRecu] = useState("");
  const [reference, setReference] = useState("");
  const [geste, setGeste] = useState<"confirmer" | "rejeter" | null>(null);

  const nombre = new Intl.NumberFormat(langue === "en" ? "en-GB" : "fr-FR");
  const jour = (iso: string) => new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));

  // Nul et zéro ne se disent pas de la même façon : le premier veut dire
  // « personne n'a regardé », le second « on a regardé et il n'y avait rien ».
  const somme = (v: number | null, devise: string): string =>
    v === null ? t.credits.paiements.nonConstate : `${nombre.format(v)} ${devise}`;

  // ─── Le détail d'un paiement ───────────────────────────────────────────────

  if (paiement) {
    const enAttente = paiement.etat === "pending";
    // Le montant constaté se renseigne toujours, même sans écart : c'est lui
    // qui permet de constater qu'il n'y en a pas. Sans lui, on ne pourrait pas
    // confirmer.
    const montantValide = /^\d+$/.test(montantRecu.trim());
    const peutConfirmer = enAttente && montantValide && reference.trim() !== "";

    const dialogue = geste === "confirmer"
      ? t.credits.decision.dialogueConfirmer
      : t.credits.decision.dialogueRejeter;

    return (
      <>
        <Breadcrumb
          racine={{ id: "tableau", label: t.fil.accueil }}
          items={[{ id: "credits", label: t.credits.titre }, { label: t.credits.detail.titre }]}
          libelle={t.fil.libelle}
          onNavigate={(id) => onRetour?.(id ?? "credits")}
        />
        <PageHeader titre={`${t.credits.detail.titre} — ${paiement.utilisateur}`} sous={jour(paiement.creeLe)} />

        <div className="gabarit-groupes">
          <section className="gabarit-groupe">
            <h2 className="gabarit-groupe-titre">{t.credits.detail.groupes.operation}</h2>
            <div className="gabarit-champ">
              <span className="gabarit-cle">{t.credits.paiements.col.etat}</span>
              <span className="gabarit-valeur">
                <StatusPill ton={TON_ETAT[paiement.etat] ?? "neutre"}>
                  {t.credits.paiements.etats[paiement.etat]}
                </StatusPill>
              </span>
            </div>
            <div className="gabarit-champ">
              <span className="gabarit-cle">{t.credits.paiements.col.mode}</span>
              <span className="gabarit-valeur">{t.credits.paiements.modes[paiement.mode]}</span>
            </div>
            <div className="gabarit-champ">
              <span className="gabarit-cle">{t.credits.detail.champs.compte}</span>
              <span className="gabarit-valeur">{paiement.compteCollecte ?? t.credits.paiements.nonConstate}</span>
            </div>
            <div className="gabarit-champ">
              <span className="gabarit-cle">{t.credits.detail.champs.reference}</span>
              <span className="gabarit-valeur">{paiement.reference ?? t.credits.paiements.nonConstate}</span>
            </div>
            {paiement.motifEchec ? (
              <div className="gabarit-champ">
                <span className="gabarit-cle">{t.credits.detail.champs.motifEchec}</span>
                <span className="gabarit-valeur">{paiement.motifEchec}</span>
              </div>
            ) : null}
          </section>

          <section className="gabarit-groupe">
            <h2 className="gabarit-groupe-titre">{t.credits.detail.groupes.montants}</h2>
            <div className="gabarit-champ">
              <span className="gabarit-cle">{t.credits.detail.champs.montant}</span>
              <span className="gabarit-valeur">{somme(paiement.montant, paiement.devise)}</span>
            </div>
            <div className="gabarit-champ">
              <span className="gabarit-cle">{t.credits.detail.champs.frais}</span>
              <span className="gabarit-valeur">{somme(paiement.frais, paiement.devise)}</span>
            </div>
            <div className="gabarit-champ">
              <span className="gabarit-cle">{t.credits.detail.champs.attendu}</span>
              <span className="gabarit-valeur">{somme(paiement.attenduSurLeCompte, paiement.devise)}</span>
            </div>
            <div className="gabarit-champ">
              <span className="gabarit-cle">{t.credits.detail.champs.recu}</span>
              <span className="gabarit-valeur">{somme(paiement.recuSurLeCompte, paiement.devise)}</span>
            </div>
            <div className="gabarit-champ">
              <span className="gabarit-cle">{t.credits.detail.champs.ecart}</span>
              <span className="gabarit-valeur">{somme(paiement.ecart, paiement.devise)}</span>
            </div>
          </section>
        </div>

        <h2 className="gabarit-groupe-titre">{t.credits.detail.groupes.histoire}</h2>
        <DataTable
          colonnes={[
            {
              cle: "etat", titre: t.credits.detail.histoire.etat, largeur: 150,
              rendu: (h) => t.credits.paiements.etats[h.etat],
            },
            { cle: "debut", titre: t.credits.detail.histoire.debut, largeur: 190, rendu: (h) => jour(h.debut) },
            {
              cle: "dureeSecondes", titre: t.credits.detail.histoire.duree, largeur: 120,
              // L'état courant dure encore : lui donner une durée figerait une
              // mesure qui bouge.
              rendu: (h) => (h.dureeSecondes === null ? t.credits.detail.enCours : duree(h.dureeSecondes)),
            },
            {
              cle: "origine", titre: t.credits.detail.histoire.origine, largeur: 180,
              rendu: (h) => t.credits.detail.origines[h.origine],
            },
            { cle: "parQui", titre: t.credits.detail.histoire.parQui, discret: true, rendu: (h) => h.parQui ?? "" },
            { cle: "motif", titre: t.credits.detail.histoire.motif, discret: true, rendu: (h) => h.motif ?? "" },
          ] as Colonne<PaiementDetail["histoire"][number] & { id: string }>[]}
          lignes={paiement.histoire.map((h, i) => ({ ...h, id: `${h.etat}-${i}` }))}
        />

        {/* La décision n'a de sens que sur un paiement en attente, et elle
            appartient au rôle admin : « seul un administrateur confirme ou
            rejette, quelle que soit la voie ». */}
        {enAttente ? (
          <RoleGate role={role} autorise="admin">
            <div className="gabarit-form">
              <p className="gabarit-note" data-ton="alerte">{t.credits.decision.avertissement}</p>

              <FormRow
                champId="montant-recu"
                label={t.credits.decision.montantRecu}
                aide={t.credits.decision.montantAide}
              >
                <input
                  id="montant-recu"
                  className="admin-champ admin-focus gabarit-saisie"
                  inputMode="numeric"
                  value={montantRecu}
                  onChange={(e) => setMontantRecu(e.target.value)}
                />
              </FormRow>

              <FormRow champId="reference" label={t.credits.decision.reference}>
                <input
                  id="reference"
                  className="admin-champ admin-focus gabarit-saisie"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </FormRow>

              <div className="gabarit-form-pied">
                <Button disabled={!peutConfirmer} onClick={() => setGeste("confirmer")}>
                  {t.credits.decision.confirmer}
                </Button>
                <Button variant="text" onClick={() => setGeste("rejeter")}>
                  {t.credits.decision.rejeter}
                </Button>
              </div>
            </div>
          </RoleGate>
        ) : null}

        {geste ? (
          <ConfirmWithReason
            destructif={geste === "rejeter"}
            titre={dialogue.titre}
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
              onDecider?.(geste === "confirmer"
                ? { decision: "confirmer", montantRecu: Number(montantRecu), reference: reference.trim(), reason: motif }
                : { decision: "rejeter", reason: motif });
              setGeste(null);
            }}
          />
        ) : null}
      </>
    );
  }

  // ─── Les trois faces ───────────────────────────────────────────────────────

  const colonnesPaiements: Colonne<PaiementLigne>[] = [
    { cle: "utilisateur", titre: t.credits.paiements.col.utilisateur, largeur: 160 },
    { cle: "mode", titre: t.credits.paiements.col.mode, largeur: 140, rendu: (p) => t.credits.paiements.modes[p.mode] },
    {
      cle: "etat", titre: t.credits.paiements.col.etat, largeur: 140,
      rendu: (p) => <StatusPill ton={TON_ETAT[p.etat] ?? "neutre"}>{t.credits.paiements.etats[p.etat]}</StatusPill>,
    },
    { cle: "montant", titre: t.credits.paiements.col.montant, aligne: "right", rendu: (p) => somme(p.montant, p.devise) },
    { cle: "methode", titre: t.credits.paiements.col.methode, discret: true, rendu: (p) => p.methode ?? t.credits.paiements.nonConstate },
    { cle: "attenduSurLeCompte", titre: t.credits.paiements.col.attendu, discret: true, aligne: "right", rendu: (p) => somme(p.attenduSurLeCompte, p.devise) },
    { cle: "recuSurLeCompte", titre: t.credits.paiements.col.recu, discret: true, aligne: "right", rendu: (p) => somme(p.recuSurLeCompte, p.devise) },
    { cle: "ecart", titre: t.credits.paiements.col.ecart, aligne: "right", rendu: (p) => somme(p.ecart, p.devise) },
    { cle: "creeLe", titre: t.credits.paiements.col.quand, discret: true, rendu: (p) => jour(p.creeLe) },
  ];

  const colonnesMouvements: Colonne<MouvementCredit>[] = [
    { cle: "utilisateur", titre: t.credits.mouvements.col.utilisateur, largeur: 160 },
    { cle: "type", titre: t.credits.mouvements.col.type, largeur: 150, rendu: (m) => t.credits.mouvements.types[m.type] },
    {
      cle: "source", titre: t.credits.mouvements.col.source, largeur: 180,
      // Chaque origine dans le mot qui lui revient : une correction ne
      // s'annonce pas « Cadeau ».
      rendu: (m) => t.credits.mouvements.sources[m.source as keyof typeof t.credits.mouvements.sources] ?? m.source,
    },
    { cle: "montant", titre: t.credits.mouvements.col.montant, aligne: "right", rendu: (m) => nombre.format(m.montant) },
    { cle: "creeLe", titre: t.credits.mouvements.col.quand, discret: true, rendu: (m) => jour(m.creeLe) },
  ];

  const etat = (actif: boolean) => (
    <StatusPill ton={actif ? "actif" : "arrete"}>
      {actif ? t.credits.reglages.actif : t.credits.reglages.inactif}
    </StatusPill>
  );

  // Les réglages appartiennent à la famille Économie, fermée au support.
  const onglets = [
    { id: "paiements", label: t.credits.onglets.paiements },
    { id: "mouvements", label: t.credits.onglets.mouvements },
    ...(role === "admin" ? [{ id: "reglages", label: t.credits.onglets.reglages }] : []),
  ];

  // Une seule action pleine, comme partout : la saisie fait avancer, l'export
  // accompagne et reste en retrait. Les deux tiennent côte à côte sans qu'on
  // hésite sur celui qui compte.
  const boutonExport = onExporter && onglet !== "reglages"
    ? (
      <ExportButton
        formats={["csv"]}
        portee={t.credits.onglets[onglet]}
        libelles={{
          exporter: t.exporter.bouton,
          avecPortee: t.exporter.avecPortee,
          encours: t.exporter.encours,
          formats: { csv: t.exporter.formatCsv },
          journal: t.exporter.journal,
        }}
        {...(exportEnCours ? { etat: "encours" as const } : {})}
        onExport={() => onExporter()}
      />
    )
    : null;
  const boutonSaisie = onSaisir && onglet === "paiements"
    ? <Button onClick={onSaisir}>{t.credits.saisie.ouvrir}</Button>
    : null;
  const actions = boutonExport || boutonSaisie
    ? <>{boutonExport}{boutonSaisie}</>
    : null;

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: t.credits.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader
        titre={t.credits.titre}
        sous={t.credits.sous}
        {...(actions ? { actions } : {})}
      />

      <PageTabs actif={onglet} onSelect={(id) => onOnglet?.(id as Onglet)} onglets={onglets} />

      {onglet === "paiements" ? (
        <>
          <FilterBar
            filtres={[
              {
                cle: "etat",
                label: t.credits.paiements.filtreEtat,
                valeur: filtreEtat,
                onChange: (e) => onFiltre?.({ etat: e.target.value }),
                options: [
                  { value: "tous", label: t.credits.paiements.tous },
                  ...(["pending", "succeeded", "failed", "expired", "refunded"] as const)
                    .map((e) => ({ value: e, label: t.credits.paiements.etats[e] })),
                ],
              },
              {
                cle: "mode",
                label: t.credits.paiements.filtreMode,
                valeur: filtreMode,
                onChange: (e) => onFiltre?.({ mode: e.target.value }),
                options: [
                  { value: "tous", label: t.credits.paiements.tous },
                  ...(["provider", "semi_manual", "manual"] as const)
                    .map((m) => ({ value: m, label: t.credits.paiements.modes[m] })),
                ],
              },
            ]}
          />
          <DataTable
            colonnes={colonnesPaiements}
            lignes={paiements}
            onOuvrir={(p) => onOuvrir?.(p)}
            vide={<EmptyState titre={t.credits.paiements.vide.titre} texte={t.credits.paiements.vide.texte} />}
          />
        </>
      ) : null}

      {onglet === "mouvements" ? (
        <DataTable
          colonnes={colonnesMouvements}
          lignes={mouvements}
          vide={<EmptyState titre={t.credits.mouvements.vide.titre} texte={t.credits.mouvements.vide.texte} />}
        />
      ) : null}

      {onglet === "reglages" ? (
        <>
          <h2 className="gabarit-groupe-titre">{t.credits.reglages.paliers.titre}</h2>
          <p className="gabarit-note">{t.credits.reglages.paliers.sous}</p>
          <DataTable
            colonnes={[
              { cle: "montant", titre: t.credits.reglages.paliers.col.montant, aligne: "right", rendu: (p) => `${nombre.format(p.montant)} ${p.devise}` },
              { cle: "credits", titre: t.credits.reglages.paliers.col.credits, aligne: "right", rendu: (p) => nombre.format(p.credits) },
              { cle: "remisePourcent", titre: t.credits.reglages.paliers.col.remise, rendu: (p) => (p.remisePourcent === null ? t.credits.reglages.aucuneRemise : `+${p.remisePourcent} %`) },
              { cle: "position", titre: t.credits.reglages.paliers.col.position, discret: true },
              { cle: "actif", titre: t.credits.reglages.paliers.col.etat, rendu: (p) => etat(p.actif) },
            ] as Colonne<Palier & { id: string }>[]}
            lignes={paliers}
          />

          <h2 className="gabarit-groupe-titre">{t.credits.reglages.canaux.titre}</h2>
          <p className="gabarit-note">{t.credits.reglages.canaux.sous}</p>
          <DataTable
            colonnes={[
              { cle: "libelle", titre: t.credits.reglages.canaux.col.libelle },
              { cle: "pays", titre: t.credits.reglages.canaux.col.pays, largeur: 100 },
              { cle: "fraisPourcent", titre: t.credits.reglages.canaux.col.frais, aligne: "right", rendu: (c) => `${c.fraisPourcent} %${c.fraisFixe > 0 ? ` + ${nombre.format(c.fraisFixe)}` : ""}` },
              { cle: "fraisPortesPar", titre: t.credits.reglages.canaux.col.portes, rendu: (c) => t.credits.reglages.canaux.portes[c.fraisPortesPar] },
              { cle: "actif", titre: t.credits.reglages.canaux.col.etat, rendu: (c) => etat(c.actif) },
            ] as Colonne<Canal & { id: string }>[]}
            lignes={canaux}
          />

          <h2 className="gabarit-groupe-titre">{t.credits.reglages.comptes.titre}</h2>
          <p className="gabarit-note">{t.credits.reglages.comptes.sous}</p>
          <DataTable
            colonnes={[
              { cle: "libelle", titre: t.credits.reglages.comptes.col.libelle },
              { cle: "operateur", titre: t.credits.reglages.comptes.col.operateur, largeur: 160 },
              // En entier : c'est un compte du SERVICE, qu'on dicte à un client
              // et qu'on lit sur l'application de l'opérateur. À ne pas
              // confondre avec la méthode d'un client, masquée partout.
              { cle: "numero", titre: t.credits.reglages.comptes.col.numero },
              { cle: "visibleDansApp", titre: t.credits.reglages.comptes.col.visible, rendu: (c) => (c.visibleDansApp ? t.credits.reglages.comptes.visible : t.credits.reglages.comptes.masque) },
              { cle: "actif", titre: t.credits.reglages.comptes.col.etat, rendu: (c) => etat(c.actif) },
            ] as Colonne<CompteCollecte & { id: string }>[]}
            lignes={comptes}
          />
        </>
      ) : null}
    </>
  );
}

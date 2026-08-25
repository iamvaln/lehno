import { useMemo, useState, type ReactNode } from "react";
import type { AdminRole, CompteDetail, Intervention } from "@lehno/contracts";
import { Breadcrumb, PageHeader, PageTabs } from "../composants/page/index.js";
import { EmptyState, StatusPill, type TonPastille } from "../composants/donnees/index.js";
import { ConfirmWithReason, RoleGate } from "../composants/actions/index.js";
import { AlertPill, AuditTrail, StatCard, Toast } from "../composants/signaux/index.js";
import { Button } from "../composants/base/index.js";
import { messages, type Langue, type Messages } from "../i18n/index.js";
import { compteDetail, interventions as interventionsDemo } from "../fixtures/index.js";

/* Le gabarit de détail — un objet, ses faces, ses actions, sa traçabilité.
 *
 * Deux règles tiennent ce fichier, et expliquent ce qu'on n'y trouve pas.
 *
 * **Le cloisonnement.** Consulter un compte donne son état, ses volumétries et
 * ses mouvements ; le contenu de ses fiches, de ses notes et de ses souhaits
 * demeure hors de portée. `compteDetailSchema` ne porte que des compteurs —
 * cette page ne rend que ce qu'il porte, et rien de ce qu'il ne porte pas. D'où
 * l'absence de tableau de murs et de tableau de mouvements : ces listes
 * n'existent dans aucun contrat, et les inventer serait ouvrir la porte.
 *
 * **Le journal d'audit est réservé à l'administrateur** (spec §6). Le prototype
 * l'ouvrait au support ; c'est la spec qui tranche.
 */

type EtatCompte = CompteDetail["etat"];
type Geste = "ajuster" | "suspendre" | "retablir";
type Onglet = "vue" | "murs" | "credits" | "securite";

const LIBELLE_ETAT: Record<EtatCompte, keyof Messages["etats"]> = {
  actif: "actif",
  suspendu: "suspendu",
  suppression_en_cours: "grace",
  efface: "efface",
};

const TON_ETAT: Record<EtatCompte, TonPastille> = {
  actif: "actif",
  suspendu: "arrete",
  suppression_en_cours: "attente",
  efface: "neutre",
};

export interface DetailProps {
  role: AdminRole;
  langue?: Langue;
  compte?: CompteDetail;
  /** L'historique des interventions sur *ce* compte. */
  interventions?: Intervention[];
  onRetour?: (id?: string) => void;
  onSuspendre?: (motif: string) => void;
  onRetablir?: (motif: string) => void;
  onAjuster?: (motif: string) => void;
}

/** Un nombre, ou le tiret qui dit qu'on ne le connaît pas encore. */
function compte_(valeur: number | null, format: Intl.NumberFormat, t: { court: string; explication: string }): ReactNode {
  if (valeur === null) return <span title={t.explication}>{t.court}</span>;
  return format.format(valeur);
}

function Champ({ cle, valeur }: { cle: string; valeur: ReactNode }): ReactNode {
  return (
    <div className="gabarit-champ">
      <span className="gabarit-champ-cle">{cle}</span>
      <span className="gabarit-champ-valeur">{valeur}</span>
    </div>
  );
}

export function Detail({
  role,
  langue = "fr",
  compte = compteDetail,
  interventions = interventionsDemo.items,
  onRetour,
  onSuspendre,
  onRetablir,
  onAjuster,
}: DetailProps): ReactNode {
  const t = messages(langue);
  const [onglet, setOnglet] = useState<Onglet>("vue");
  const [geste, setGeste] = useState<Geste | null>(null);
  const [accuse, setAccuse] = useState<string | null>(null);

  const locale = langue === "en" ? "en-GB" : "fr-FR";
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }),
    [locale],
  );
  const nombre = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const jour = (iso: string) => date.format(new Date(iso));
  const suspendu = compte.etat === "suspendu";
  const dialogue = geste ? t.comptes[geste] : null;

  const confirmer = (motif: string) => {
    if (!geste) return;
    if (geste === "suspendre") onSuspendre?.(motif);
    if (geste === "retablir") onRetablir?.(motif);
    if (geste === "ajuster") onAjuster?.(motif);
    setAccuse(t.comptes.faits[geste].replace("{motif}", motif));
    setGeste(null);
  };

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ id: "comptes", label: t.compte.fil }, { label: compte.pseudo }]}
        libelle={t.fil.libelle}
        onNavigate={(id) => onRetour?.(id)}
      />

      <PageHeader
        titre={compte.pseudo}
        sous={t.compte.sous.replace("{email}", compte.email).replace("{date}", jour(compte.inscritLe))}
        actions={
          <RoleGate role={role} autorise="admin">
            <Button variant="outline" onClick={() => setGeste("ajuster")}>
              {t.comptes.actions.ajuster}
            </Button>
            {suspendu ? (
              <Button variant="outline" onClick={() => setGeste("retablir")}>
                {t.comptes.actions.retablir}
              </Button>
            ) : (
              <Button variant="destructive-outline" onClick={() => setGeste("suspendre")}>
                {t.comptes.actions.suspendre}
              </Button>
            )}
          </RoleGate>
        }
      />

      {suspendu ? (
        <div className="gabarit-alerte">
          <AlertPill ton="alerte">{t.compte.suspendu}</AlertPill>
        </div>
      ) : null}

      <PageTabs
        actif={onglet}
        onSelect={(id) => setOnglet(id as Onglet)}
        onglets={[
          { id: "vue", label: t.compte.onglets.vue },
          // Sans mesure, pas de pastille de compte : « 0 » dirait que ce
          // compte n'a aucun Mur, alors qu'on n'en sait rien.
          { id: "murs", label: t.compte.onglets.murs, ...(compte.volumetrie.murs === null ? {} : { compte: compte.volumetrie.murs }) },
          { id: "credits", label: t.compte.onglets.credits },
          { id: "securite", label: t.compte.onglets.securite },
        ]}
      />

      {onglet === "vue" ? (
        <>
          <div className="gabarit-groupes">
            <section className="gabarit-groupe">
              <h2 className="gabarit-groupe-titre">{t.compte.groupes.compte}</h2>
              <Champ
                cle={t.compte.champs.etat}
                valeur={<StatusPill ton={TON_ETAT[compte.etat]}>{t.etats[LIBELLE_ETAT[compte.etat]]}</StatusPill>}
              />
              <Champ cle={t.compte.champs.langue} valeur={compte.langue} />
              <Champ cle={t.compte.champs.inscrit} valeur={jour(compte.inscritLe)} />
              {compte.derniereConnexion ? (
                <Champ cle={t.compte.champs.derniere} valeur={jour(compte.derniereConnexion)} />
              ) : null}
            </section>

            {/* Des volumétries, et rien d'autre : on compte, on n'ouvre pas. */}
            <section className="gabarit-groupe">
              <h2 className="gabarit-groupe-titre">{t.compte.groupes.usage}</h2>
              <Champ cle={t.compte.champs.proches} valeur={nombre.format(compte.volumetrie.proches)} />
              <Champ cle={t.compte.champs.occasions} valeur={nombre.format(compte.volumetrie.occasions)} />
              <Champ cle={t.compte.champs.notes} valeur={nombre.format(compte.volumetrie.notes)} />
              <Champ cle={t.compte.champs.murs} valeur={compte_(compte.volumetrie.murs, nombre, t.nonMesure)} />
            </section>
          </div>
          <p className="gabarit-note">{t.compte.cloisonnement}</p>
        </>
      ) : null}

      {onglet === "murs" ? (
        <>
          <h2 className="gabarit-groupe-titre">{t.compte.murs.titre}</h2>
          {compte.volumetrie.murs === null ? (
            <EmptyState titre={t.nonMesure.explication} texte={t.nonMesure.bloc} />
          ) : compte.volumetrie.murs > 0 ? (
            <div className="gabarit-chiffres">
              <StatCard libelle={t.compte.champs.murs} valeur={nombre.format(compte.volumetrie.murs)} />
            </div>
          ) : (
            <EmptyState titre={t.compte.murs.vide.titre} texte={t.compte.murs.vide.texte} />
          )}
          <p className="gabarit-note">{t.compte.murs.note}</p>
        </>
      ) : null}

      {onglet === "credits" ? (
        <>
          <h2 className="gabarit-groupe-titre">{t.compte.groupes.credits}</h2>
          {compte.credits === null ? (
            <EmptyState titre={t.nonMesure.explication} texte={t.nonMesure.bloc} />
          ) : (
            <>
              <div className="gabarit-chiffres">
                <StatCard libelle={t.compte.champs.solde} valeur={nombre.format(compte.credits.solde)} />
                <StatCard libelle={t.compte.champs.achetes} valeur={nombre.format(compte.credits.achetes)} />
                <StatCard libelle={t.compte.champs.offerts} valeur={nombre.format(compte.credits.offerts)} />
              </div>
              <p className="gabarit-note">{t.compte.credits.note}</p>
            </>
          )}
        </>
      ) : null}

      {onglet === "securite" ? (
        <>
          <div className="gabarit-groupes">
            <section className="gabarit-groupe">
              <h2 className="gabarit-groupe-titre">{t.compte.securite.titre}</h2>
              {compte.derniereConnexion ? (
                <Champ cle={t.compte.champs.derniere} valeur={jour(compte.derniereConnexion)} />
              ) : null}
              <Champ cle={t.compte.champs.inscrit} valeur={jour(compte.inscritLe)} />
            </section>
          </div>
          {/* Aucune session n'est portée par le détail d'un compte : le contrat
              n'en rend pas, et un écran ne montre pas ce qu'on ne lui donne pas. */}
          <EmptyState titre={t.compte.securite.vide.titre} texte={t.compte.securite.vide.texte} />
          <p className="gabarit-note">{t.compte.securite.note}</p>
        </>
      ) : null}

      {/* « La traçabilité se lit depuis l'objet » : en pied de détail, quelle que
          soit la face ouverte — et réservée à l'administrateur (§6). */}
      <RoleGate role={role} autorise="admin">
        <div className="gabarit-pied">
          {interventions.length > 0 ? (
            <AuditTrail entrees={interventions} titre={t.audit.titre} libelleMotif={t.audit.col.motif} />
          ) : (
            <>
              <h2 className="gabarit-groupe-titre">{t.audit.titre}</h2>
              <EmptyState titre={t.audit.vide.titre} texte={t.audit.vide.texte} />
            </>
          )}
        </div>
      </RoleGate>

      {geste && dialogue ? (
        <ConfirmWithReason
          destructif={geste === "suspendre"}
          titre={dialogue.titre.replace("{pseudo}", compte.pseudo)}
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
          onConfirmer={confirmer}
        />
      ) : null}

      {accuse ? (
        <Toast libelleFermer={t.commun.fermer} onDismiss={() => setAccuse(null)}>
          {accuse}
        </Toast>
      ) : null}
    </>
  );
}

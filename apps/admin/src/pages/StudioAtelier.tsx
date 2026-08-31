import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { DataTable, EmptyState, StatusPill, type Colonne } from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type {
  AdminRole, CandidatsStudio, ConfigurationPortrait, EssaiStudio,
  ProfilStudio, ReglagesPortrait,
} from "@lehno/contracts";

/**
 * L'Atelier — un poste de travail qui se lit d'un regard.
 *
 * **Tout est visible en même temps.** Pas d'étapes, pas de frise : régler et
 * essayer ne sont pas deux moments mais un seul geste répété, et découper
 * l'écran en temps successifs obligeait à revenir en arrière à chaque tour.
 *
 * **Deux familles de réglages, distinguées sans explication.** Ce que le modèle
 * lit porte un liséré d'action — chaque changement demande un nouvel essai. Ce
 * que seule l'application lit n'en porte pas.
 *
 * **Quatre gestes, parce qu'ils coûtent quatre choses différentes.**
 * Prévisualiser appelle le modèle — du temps et de l'argent. Garder retient le
 * brouillon. Écarter revient au dernier gardé. Publier met en service. Fondre
 * l'enregistrement dans la prévisualisation obligerait à payer un appel pour ne
 * pas perdre son travail.
 *
 * **Garder et Écarter n'existent qu'après un essai, et le disent** — cacher le
 * second ferait croire qu'un essai raté est irréversible. **Publier reste
 * inerte sans essai réussi** et dit lui-même ce qui lui manque : on ne met pas
 * en service ce qu'on n'a pas vu.
 *
 * **Pas de repli ici.** Le routeur bascule au modèle suivant pour ce qui tourne
 * sans témoin ; à l'Atelier on essaie le modèle demandé, ou l'échec se dit en le
 * nommant — sans quoi on publierait sur la foi d'un résultat produit ailleurs.
 *
 * **Aucun compteur de dépense.** Le prix reste fiche technique du modèle : de
 * quoi choisir lequel appeler, pas un budget qui descend pendant qu'on travaille.
 */
export interface StudioAtelierProps {
  role: AdminRole;
  langue?: Langue;
  /** Le brouillon s'il existe, la version en service sinon : on compose
   *  toujours à partir de ce qui est déjà quelque part. */
  depart: ConfigurationPortrait;
  profils: ProfilStudio[];
  candidats: CandidatsStudio;
  essais: EssaiStudio[];
  /** Le dernier essai de la séance, celui qu'on regarde. Nul avant le premier. */
  dernier: EssaiStudio | null;
  enCours?: boolean;
  onEssayer?: (reglages: ReglagesPortrait, profileId: string, ambianceId: string) => void;
  onGarder?: (reglages: ReglagesPortrait) => void;
  onEcarter?: () => void;
  onPublier?: (configId: string, note: string) => void;
  onRetour?: (id: string) => void;
}

const remplir = (gabarit: string, valeurs: Record<string, string | number>): string =>
  Object.entries(valeurs).reduce((a, [c, v]) => a.split(`{${c}}`).join(String(v)), gabarit);

export function StudioAtelier(
  {
    role, langue = "fr", depart, profils, candidats, essais, dernier,
    enCours = false, onEssayer, onGarder, onEcarter, onPublier, onRetour,
  }: StudioAtelierProps,
): ReactNode {
  const t = messages(langue);
  const d = t.studioAtelier;

  const [reglages, setReglages] = useState<ReglagesPortrait>(depart.reglages);
  const [ambianceId, setAmbianceId] = useState<string>(depart.reglages.ambiances[0]?.id ?? "");
  const [profileId, setProfileId] = useState<string>(profils[0]?.id ?? "");
  const [sale, setSale] = useState(false);
  const [publication, setPublication] = useState(false);

  const ambiance = reglages.ambiances.find((a) => a.id === ambianceId) ?? null;
  const rendu = dernier !== null && dernier.etat === "success";

  /* Le modèle appelé se DÉDUIT de l'ambiance : une famille d'illustration et un
     style de photo ne passent pas par le même. Sans elle, l'essai choisirait
     pour nous, et prouverait une voie qu'on ne voulait pas éprouver. */
  const cleModele = ambiance?.groupe === "photo_style"
    ? reglages.modeles.photo_style
    : reglages.modeles.illustration;
  const modele = candidats.modeles.find((m) => m.cle === cleModele) ?? null;

  const poserConsigne = (texte: string): void => {
    if (ambiance === null) return;
    setReglages((r) => ({
      ...r,
      ambiances: r.ambiances.map((a) =>
        a.id === ambiance.id ? { ...a, consigne: { ...a.consigne, [langue]: texte } } : a),
    }));
    setSale(true);
  };

  const poserMotif = (cle: "bande" | "fondSansImage", valeur: string): void => {
    setReglages((r) => ({ ...r, motifs: { ...r.motifs, [cle]: valeur } as typeof r.motifs }));
    setSale(true);
  };

  const colonnes: Colonne<EssaiStudio & { id: string }>[] = [
    {
      cle: "quand",
      titre: d.journal.col.quand,
      rendu: (e) => new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
        hour: "2-digit", minute: "2-digit",
      }).format(new Date(e.quand)),
    },
    { cle: "modele", titre: d.journal.col.modele, rendu: (e) => e.modele.cle },
    {
      cle: "etat",
      titre: d.journal.col.etat,
      rendu: (e) => (
        <StatusPill ton={e.etat === "success" ? "actif" : e.etat === "refused" ? "attente" : "arrete"}>
          {d.journal.etats[e.etat]}
        </StatusPill>
      ),
    },
    {
      cle: "cout",
      titre: d.journal.col.cout,
      // Nul = « on ne sait pas », jamais « gratuit ».
      rendu: (e) => (e.cout === null ? d.ouvrage.coutInconnu : remplir(d.ouvrage.cout, { cout: e.cout })),
    },
    { cle: "parQui", titre: d.journal.col.parQui, rendu: (e) => e.parQui ?? "—" },
  ];

  /* Ce qui empêche de publier, dit par le serveur plutôt que redeviné ici : un
     booléen seul obligerait l'écran à refaire la règle, et à la refaire faux le
     jour où elle change. */
  const empechement = !rendu
    ? d.gestes.publierSansEssai
    : depart.blocage === "deja_en_service"
      ? d.gestes.publierDejaEnService
      : depart.blocage === "etat_depasse"
        ? d.gestes.publierDepasse
        : null;

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: d.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader titre={d.titre} sous={d.sous} />

      {profils.length === 0 ? (
        <EmptyState titre={d.sansProfil.titre} texte={d.sansProfil.texte} />
      ) : (
        <>
          <section className="admin-section" role="region" aria-labelledby="atelier-chaine">
            <h2 id="atelier-chaine" className="admin-section-titre">{d.chaine.titre}</h2>
            <div className="admin-rang">
              <label htmlFor="atelier-ambiance">{d.chaine.ambiance}</label>
              <select
                id="atelier-ambiance"
                value={ambianceId}
                onChange={(e) => setAmbianceId(e.target.value)}
                disabled={role !== "admin"}
              >
                {reglages.ambiances.map((a) => (
                  <option key={a.id} value={a.id}>{a.libelle[langue]}</option>
                ))}
              </select>
            </div>
            <div className="admin-rang">
              <label htmlFor="atelier-profil">{d.chaine.profil}</label>
              <select
                id="atelier-profil"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                disabled={role !== "admin"}
              >
                {profils.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
              </select>
            </div>
            <p>
              <strong>{d.chaine.modele}</strong>{" "}
              {modele === null ? cleModele : `${modele.cle}`}
              {/* Le prix est une fiche technique, pas un budget. */}
              {modele?.tarifs === undefined ? ` · ${d.chaine.sansTarif}` : null}
            </p>
            {/* Un modèle écarté du routage s'appelle quand même ici : c'est là
                qu'on va voir s'il est revenu. */}
            {modele?.enPanneJusqua ? (
              <p className="admin-section-sous">
                {remplir(d.chaine.enPanne, { date: modele.enPanneJusqua })} — {d.chaine.enPanneAide}
              </p>
            ) : null}
          </section>

          {/* Ce que le modèle LIT : liséré d'action, chaque changement demande
              un nouvel essai. */}
          <section className="admin-section admin-lu-par-le-modele" role="region" aria-labelledby="atelier-lu">
            <h2 id="atelier-lu" className="admin-section-titre">{d.lu.titre}</h2>
            <div className="admin-rang">
              <label htmlFor="atelier-consigne">
                {d.lu.consigne}
                {sale ? ` — ${d.lu.nonEnregistre}` : ""}
              </label>
              <textarea
                id="atelier-consigne"
                rows={4}
                value={ambiance?.consigne[langue] ?? ""}
                onChange={(e) => poserConsigne(e.target.value)}
                disabled={role !== "admin" || ambiance === null}
              />
            </div>
            <p className="admin-section-sous">{d.lu.consigneAide}</p>
          </section>

          <section className="admin-section" role="region" aria-labelledby="atelier-interne">
            <h2 id="atelier-interne" className="admin-section-titre">{d.interne.titre}</h2>
            {([["bande", d.interne.motifBande], ["fondSansImage", d.interne.motifFond]] as const).map(
              ([cle, libelle]) => (
                <div className="admin-rang" key={cle}>
                  <label htmlFor={`atelier-motif-${cle}`}>{libelle}</label>
                  <select
                    id={`atelier-motif-${cle}`}
                    value={reglages.motifs[cle]}
                    onChange={(e) => poserMotif(cle, e.target.value)}
                    disabled={role !== "admin"}
                  >
                    {candidats.motifs.map((m) => (
                      <option key={m} value={m}>
                        {d.interne.motifs[m as keyof typeof d.interne.motifs] ?? m}
                      </option>
                    ))}
                  </select>
                </div>
              ),
            )}
          </section>

          <section className="admin-section" role="region" aria-labelledby="atelier-ouvrage">
            <h2 id="atelier-ouvrage" className="admin-section-titre">{d.ouvrage.titre}</h2>
            {dernier === null ? (
              <p className="admin-section-sous">{d.ouvrage.vide}</p>
            ) : dernier.etat !== "success" ? (
              <>
                {/* Trois issues, trois gestes. Les confondre en un « échec »
                    ferait réessayer trente fois une demande que le modèle
                    refusera toujours. */}
                <p>
                  {dernier.etat === "refused"
                    ? d.ouvrage.echecRefus
                    : dernier.etat === "timeout"
                      ? d.ouvrage.echecDelai
                      : d.ouvrage.echecPanne}
                </p>
                {dernier.erreur === null ? null : (
                  <p className="admin-section-sous">{remplir(d.ouvrage.code, { code: dernier.erreur })}</p>
                )}
                <p className="admin-section-sous">{d.ouvrage.sansRepli}</p>
              </>
            ) : (
              <Ouvrage sortie={dernier.sortie} alt={d.ouvrage.alt} />
            )}
          </section>

          {role === "admin" ? (
            <section className="admin-section" role="region" aria-labelledby="atelier-gestes">
              <h2 id="atelier-gestes" className="admin-section-titre">{d.gestes.essayer}</h2>
              <div className="admin-actions">
                <button
                  type="button"
                  disabled={enCours || ambiance === null || profileId === ""}
                  onClick={() => onEssayer?.(reglages, profileId, ambianceId)}
                >
                  {enCours ? d.gestes.enCours : d.gestes.essayer}
                </button>
                <button
                  type="button"
                  disabled={!rendu}
                  onClick={() => { onGarder?.(reglages); setSale(false); }}
                >
                  {d.gestes.garder}
                </button>
                <button
                  type="button"
                  disabled={!rendu}
                  onClick={() => { setReglages(depart.reglages); setSale(false); onEcarter?.(); }}
                >
                  {d.gestes.ecarter}
                </button>
                <button
                  type="button"
                  disabled={empechement !== null}
                  onClick={() => setPublication(true)}
                >
                  {d.gestes.publier}
                </button>
              </div>
              {/* Les deux gestes qui n'existent pas encore le disent, et le
                  bouton inerte dit ce qui lui manque. */}
              {rendu ? null : <p className="admin-section-sous">{d.gestes.avantEssai}</p>}
              {empechement === null ? null : <p className="admin-section-sous">{empechement}</p>}
            </section>
          ) : null}

          <section className="admin-section" role="region" aria-labelledby="atelier-journal">
            <h2 id="atelier-journal" className="admin-section-titre">{d.journal.titre}</h2>
            <p className="admin-section-sous">{d.journal.sous}</p>
            <DataTable
              colonnes={colonnes}
              lignes={essais.map((e) => ({ ...e, id: e.id }))}
              libelles={{ actions: t.table.actions }}
              vide={<EmptyState titre={d.journal.vide} texte={d.journal.sous} />}
            />
          </section>

          <p className="admin-section-sous">{d.rappel}</p>
        </>
      )}

      {publication ? (
        <ConfirmWithReason
          titre={d.publier.titre}
          consequence={d.publier.consequence}
          motifs={[...d.publier.motifs]}
          libelles={{
            motif: t.confirmation.motif,
            choisir: t.confirmation.motifManquant,
            autre: t.confirmation.autre,
            precision: t.confirmation.autrePlaceholder,
            journal: t.confirmation.motifAide,
            annuler: t.confirmation.annuler,
            confirmer: t.confirmation.confirmer,
          }}
          onAnnuler={() => setPublication(false)}
          onConfirmer={(note) => { onPublier?.(depart.id, note); setPublication(false); }}
        />
      ) : null}
    </>
  );
}

/* Une sortie d'image porte `{ cle, url }` ; une sortie de texte porte
   `{ message }`. On devine à la présence de l'une plutôt que d'attendre un champ
   « type » que personne ne penserait à remplir. */
function Ouvrage({ sortie, alt }: { sortie: unknown; alt: string }): ReactNode {
  if (sortie === null || typeof sortie !== "object") return null;
  const contenu = sortie as { url?: unknown; message?: unknown };
  if (typeof contenu.url === "string") {
    return <img src={contenu.url} alt={alt} style={{ maxWidth: "100%", borderRadius: "var(--radius-lg)" }} />;
  }
  if (typeof contenu.message === "string") return <p>{contenu.message}</p>;
  return null;
}

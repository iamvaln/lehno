import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { DataTable, EmptyState, StatusPill, type Colonne } from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { AdminRole, GabaritStudio } from "@lehno/contracts";

/**
 * Le studio du portrait — ux-admin §5.9, entrée « **réglages en service** ».
 *
 * Ce que l'écran montre : ce qui tourne aujourd'hui, l'historique des
 * publications, et le retour arrière qui republie une version antérieure sans
 * la reconstruire. C'est ce que le serveur sert, et rien de plus.
 *
 * **Ce qu'il ne montre pas, et pourquoi.** §5.9 décrit trois entrées ; deux
 * n'ont aucune matière en base.
 *
 * - La **composition** suppose un brouillon — « rien ne change pour les
 *   utilisateurs tant qu'on n'a pas publié ». Le modèle n'en a pas : créer une
 *   version la met en service au même geste. Un onglet « composition » bâti
 *   dessus publierait à chaque frappe, c'est-à-dire l'inverse de sa promesse.
 * - Le **banc d'essai** appelle un modèle et se paie en argent réel. Aucun
 *   fournisseur n'est branché dans le dépôt, et `AIUsage` n'existe pas : ni
 *   l'essai, ni son coût, ni le plafond quotidien n'ont où se poser.
 *
 * Manquent aussi les **orientations**, les **ambiances** et le **motif
 * identitaire** : aucune table ne les porte, et le catalogue que
 * l'application consomme (`/me/studio/options`) n'est servi par personne.
 *
 * L'écran le dit en toutes lettres plutôt que d'ouvrir des onglets vides. Un
 * onglet vide se lit comme une panne ; une phrase se lit comme un état.
 */
export interface StudioProps {
  role: AdminRole;
  langue?: Langue;
  gabarits: GabaritStudio[];
  /** Republie une version antérieure. À l'appelant de l'envoyer au serveur. */
  onRevenir?: (gabarit: GabaritStudio, motif: string) => void;
  onRetour?: (id: string) => void;
}

/** Un gabarit et son historique : une seule version en service, les autres derrière. */
type Famille = {
  genre: GabaritStudio["genre"];
  cle: string;
  enService: GabaritStudio | null;
  versions: GabaritStudio[];
};

/**
 * Le serveur rend une liste plate de versions ; l'écran raisonne par gabarit.
 * Le regroupement se fait ici plutôt qu'au serveur : c'est une forme de lecture,
 * et la liste plate sert aussi bien un filtre par genre.
 */
function parFamille(gabarits: GabaritStudio[]): Famille[] {
  const familles = new Map<string, Famille>();
  for (const g of gabarits) {
    const cleFamille = `${g.genre}/${g.cle}`;
    const famille = familles.get(cleFamille)
      ?? { genre: g.genre, cle: g.cle, enService: null, versions: [] };
    famille.versions.push(g);
    if (g.actif) famille.enService = g;
    familles.set(cleFamille, famille);
  }
  return [...familles.values()].map((f) => ({
    ...f,
    // La plus récente en tête : on ouvre l'historique pour voir ce qui tourne,
    // et remonter ensuite.
    versions: [...f.versions].sort((a, b) => b.version - a.version),
  }));
}

export function Studio({ role, langue = "fr", gabarits, onRevenir, onRetour }: StudioProps): ReactNode {
  const t = messages(langue);
  const [geste, setGeste] = useState<GabaritStudio | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const familles = parFamille(gabarits);

  const dire = (modele: GabaritStudio["modele"]): string =>
    modele === null ? t.studio.parPriorite : `${modele.fournisseur} · ${modele.cle}`;

  const colonnes: Colonne<Famille & { id: string }>[] = [
    { cle: "genre", titre: t.studio.col.genre, largeur: 190, rendu: (f) => t.studio.genres[f.genre] },
    { cle: "cle", titre: t.studio.col.cle },
    {
      cle: "version",
      titre: t.studio.col.version,
      largeur: 130,
      // Un gabarit sans version en service est un gabarit que la génération ne
      // trouvera pas. Ça se voit, plutôt que de se lire comme une case vide.
      rendu: (f) => (f.enService
        ? <StatusPill ton="actif">{t.studio.version.replace("{n}", String(f.enService.version))}</StatusPill>
        : <StatusPill ton="arrete">{t.studio.aucune}</StatusPill>),
    },
    {
      cle: "modele",
      titre: t.studio.col.modele,
      discret: true,
      rendu: (f) => (f.enService ? dire(f.enService.modele) : t.entrees.inconnu),
    },
    {
      cle: "parQui",
      titre: t.studio.col.parQui,
      discret: true,
      largeur: 220,
      rendu: (f) => f.enService?.parQui ?? t.studio.parMigration,
    },
  ];

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: t.studio.titre }]}
        libelle={t.fil.libelle}
        onNavigate={() => onRetour?.("tableau")}
      />
      <PageHeader titre={t.studio.titre} sous={t.studio.sous} />

      {/* Ce que la section ne couvre pas encore, dit une fois. Un administrateur
          qui cherche le banc d'essai doit apprendre qu'il n'existe pas, pas le
          chercher dans un onglet. */}
      <p className="admin-studio-portee">{t.studio.portee}</p>

      <DataTable
        colonnes={colonnes}
        lignes={familles.map((f) => ({ ...f, id: `${f.genre}/${f.cle}` }))}
        libelles={{ actions: t.table.actions }}
        onOuvrir={(f) => setOuverte(ouverte === f.id ? null : f.id)}
        vide={<EmptyState titre={t.studio.vide.titre} texte={t.studio.vide.texte} />}
      />

      {familles
        .filter((f) => ouverte === `${f.genre}/${f.cle}`)
        .map((f) => (
          <section key={`${f.genre}/${f.cle}`} className="admin-studio-histoire">
            <h2 className="gabarit-groupe-titre">
              {t.studio.historique.replace("{cle}", f.cle)}
            </h2>
            <DataTable
              colonnes={[
                {
                  cle: "version",
                  titre: t.studio.col.version,
                  largeur: 130,
                  rendu: (g: GabaritStudio) => (g.actif
                    ? <StatusPill ton="actif">{t.studio.version.replace("{n}", String(g.version))}</StatusPill>
                    : t.studio.version.replace("{n}", String(g.version))),
                },
                { cle: "corps", titre: t.studio.col.corps },
                { cle: "modele", titre: t.studio.col.modele, discret: true, rendu: (g: GabaritStudio) => dire(g.modele) },
                {
                  cle: "parQui",
                  titre: t.studio.col.parQui,
                  discret: true,
                  largeur: 220,
                  rendu: (g: GabaritStudio) => g.parQui ?? t.studio.parMigration,
                },
              ]}
              lignes={f.versions}
              libelles={{ actions: t.table.actions }}
              {...(role === "admin"
                ? {
                  // Aucun geste sur la version en service : y « revenir » ne
                  // changerait rien, et l'offrir laisserait croire le contraire.
                  actions: (g: GabaritStudio) => (g.actif ? [] : [{ id: "revenir", label: t.studio.revenir }]),
                  onAction: (_id: string, g: GabaritStudio) => setGeste(g),
                }
                : {})}
              vide={<EmptyState titre={t.studio.vide.titre} texte={t.studio.vide.texte} />}
            />
          </section>
        ))}

      {geste ? (
        <ConfirmWithReason
          titre={t.studio.dialogue.titre.replace("{n}", String(geste.version))}
          consequence={t.studio.dialogue.consequence}
          motifs={[...t.studio.dialogue.motifs]}
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
            onRevenir?.(geste, motif);
            setGeste(null);
          }}
        />
      ) : null}
    </>
  );
}

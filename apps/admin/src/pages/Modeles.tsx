import { useState, type ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { DataTable, EmptyState, StatusPill, type Colonne } from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { AdminRole, ChaineIa, ModeleIa } from "@lehno/contracts";

/**
 * Le catalogue des modèles, et la chaîne de repli de chaque tâche.
 *
 * Deux états, jamais fondus en un seul « disponible ». **Éteint** est la
 * décision d'un humain ; **en panne** est le constat du disjoncteur. Ils se
 * réparent par des gestes opposés — le premier attend qu'on le rallume, le
 * second se rouvre seul — et les confondre à l'écran ferait attendre une
 * reprise qui ne viendra jamais.
 *
 * Le **fournisseur est répété à chaque rang** de chaque chaîne. C'est
 * redondant avec le catalogue, et c'est voulu : c'est ce qui rend visible d'un
 * coup d'œil qu'on vient d'aligner trois modèles du même hébergeur — une
 * chaîne qu'une seule panne emporte en entier, donc un repli qui n'aura jamais
 * lieu.
 *
 * Ce que cet écran **ne montre pas** : la dépense réelle et ce qu'elle a
 * rapporté, que le §5.8 demande face à face. `ActionRun` n'existe pas en base.
 * L'écran le dit en toutes lettres plutôt que d'afficher des zéros là où
 * devrait se lire une marge — un zéro dans un calcul de marge se prend pour un
 * fait.
 */
export interface ModelesProps {
  role: AdminRole;
  langue?: Langue;
  modeles: ModeleIa[];
  chaines?: ChaineIa[];
  onBasculer?: (modele: ModeleIa, actif: boolean, motif: string) => void;
  onReordonner?: (tache: string, modeleIds: string[], motif: string) => void;
  onRetour?: (id: string) => void;
}

export function Modeles({
  role, langue = "fr", modeles, chaines = [], onBasculer, onReordonner, onRetour,
}: ModelesProps): ReactNode {
  const t = messages(langue);
  const [geste, setGeste] = useState<ModeleIa | null>(null);
  const [deplacement, setDeplacement] = useState<{ tache: string; ids: string[]; sens: "haut" | "bas" } | null>(null);

  // Un coût absent n'est pas un coût nul : c'est un modèle qu'on n'a pas encore
  // tarifé. « 0 » le ferait passer pour gratuit.
  const cout = (valeur: number | null): string =>
    valeur === null ? t.modeles.sansCout : `${valeur} ${t.modeles.unite}`;

  const colonnes: Colonne<ModeleIa>[] = [
    { cle: "fournisseur", titre: t.modeles.col.fournisseur, largeur: 150 },
    { cle: "modele", titre: t.modeles.col.modele },
    {
      cle: "capacite",
      titre: t.modeles.col.capacite,
      largeur: 110,
      rendu: (m) => (m.capacite === "image" ? t.modeles.capacites.image : t.modeles.capacites.texte),
    },
    {
      cle: "actif",
      titre: t.modeles.col.etat,
      largeur: 170,
      /* Les deux états côte à côte, jamais l'un à la place de l'autre : un
         modèle peut être en service ET momentanément injoignable, et c'est
         justement l'état où l'on se demande pourquoi rien ne sort. */
      rendu: (m) => (
        <>
          <StatusPill ton={m.actif ? "actif" : "arrete"}>
            {m.actif ? t.modeles.etats.actif : t.modeles.etats.eteint}
          </StatusPill>
          {m.enPanneJusquA ? (
            <StatusPill ton="attente">{t.modeles.etats.enPanne}</StatusPill>
          ) : null}
        </>
      ),
    },
    {
      cle: "emplois",
      titre: t.modeles.col.emplois,
      discret: true,
      // Où ce modèle sert, pour qu'on voie ce qu'on casse avant de l'éteindre.
      rendu: (m) => (m.emplois.length === 0
        ? t.modeles.sansEmploi
        : m.emplois.map((e) => `${t.modeles.taches[e.tache] ?? e.tache} (${e.rang})`).join(" · ")),
    },
    { cle: "coutEntree", titre: t.modeles.col.entree, discret: true, aligne: "right", rendu: (m) => cout(m.coutEntree) },
    { cle: "coutSortie", titre: t.modeles.col.sortie, discret: true, aligne: "right", rendu: (m) => cout(m.coutSortie) },
  ];

  const dialogue = geste?.actif === true ? t.modeles.dialogueEteindre : t.modeles.dialogueRallumer;

  // Déplacer une entrée dans la chaîne. On envoie l'ORDRE ENTIER, jamais un
  // échange de deux rangs : la base porte une unicité sur (tâche, rang), et un
  // échange en deux écritures la viole au milieu du chemin.
  const deplacer = (chaine: ChaineIa, index: number, sens: "haut" | "bas"): string[] => {
    const ids = chaine.rangs.map((r) => r.modeleId);
    const cible = sens === "haut" ? index - 1 : index + 1;
    [ids[index], ids[cible]] = [ids[cible] as string, ids[index] as string];
    return ids;
  };

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
        // Le rôle retire : seul un administrateur touche au catalogue.
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

      <h2 className="gabarit-titre-section">{t.modeles.chaines.titre}</h2>
      <p className="gabarit-note">{t.modeles.chaines.sous}</p>

      {chaines.map((chaine) => (
        <section key={chaine.tache} className="gabarit-chaine" aria-label={t.modeles.taches[chaine.tache] ?? chaine.tache}>
          <h3>{t.modeles.taches[chaine.tache] ?? chaine.tache}</h3>

          {chaine.rangs.length === 0 ? (
            <p className="gabarit-note">{t.modeles.chaines.vide}</p>
          ) : (
            <ol>
              {chaine.rangs.map((r, i) => (
                <li key={r.modeleId}>
                  <span>{r.rang}</span>
                  {/* Le fournisseur d'abord : c'est lui qui tombe, pas le modèle. */}
                  <strong>{r.fournisseur}</strong>
                  <span>{r.modele}</span>
                  {!r.actif ? <StatusPill ton="arrete">{t.modeles.etats.eteint}</StatusPill> : null}
                  {r.enPanne ? <StatusPill ton="attente">{t.modeles.etats.enPanne}</StatusPill> : null}
                  {role === "admin" ? (
                    <>
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => setDeplacement({ tache: chaine.tache, ids: deplacer(chaine, i, "haut"), sens: "haut" })}
                      >
                        {t.modeles.chaines.promouvoir}
                      </button>
                      <button
                        type="button"
                        disabled={i === chaine.rangs.length - 1}
                        onClick={() => setDeplacement({ tache: chaine.tache, ids: deplacer(chaine, i, "bas"), sens: "bas" })}
                      >
                        {t.modeles.chaines.declasser}
                      </button>
                    </>
                  ) : null}
                </li>
              ))}
            </ol>
          )}

          {/* Des avertissements, pas des refus : une chaîne courte est un
              jugement d'exploitation. Deux fournisseurs seulement produisent
              des images — l'interdire rendrait ces tâches inconfigurables. */}
          {chaine.avertissements.map((a) => (
            <p key={a.code} className="gabarit-alerte" role="status">
              {a.code === "chaine_courte"
                ? t.modeles.chaines.avertissements.courte
                  .replace("{rangs}", String(a.rangs ?? 0))
                  .replace("{recommande}", String(a.recommande ?? 0))
                : t.modeles.chaines.avertissements.fournisseurRepete}
            </p>
          ))}
        </section>
      ))}

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

      {deplacement ? (
        <ConfirmWithReason
          titre={t.modeles.chaines.dialogue.titre}
          consequence={t.modeles.chaines.dialogue.consequence}
          motifs={[...t.modeles.chaines.dialogue.motifs]}
          libelles={{
            motif: t.confirmation.motif,
            choisir: t.confirmation.motifManquant,
            autre: t.confirmation.autre,
            precision: t.confirmation.autrePlaceholder,
            journal: t.confirmation.motifAide,
            annuler: t.confirmation.annuler,
            confirmer: t.confirmation.confirmer,
          }}
          onAnnuler={() => setDeplacement(null)}
          onConfirmer={(motif) => {
            onReordonner?.(deplacement.tache, deplacement.ids, motif);
            setDeplacement(null);
          }}
        />
      ) : null}
    </>
  );
}

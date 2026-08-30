import type { ReactNode } from "react";
import { Breadcrumb, PageHeader } from "../composants/page/index.js";
import { DataTable, EmptyState, FilterBar, GrapheJours, type Colonne } from "../composants/donnees/index.js";
import { StatCard } from "../composants/signaux/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type {
  Aboutissement, ModeTransaction, PeriodeTransactions, SensTransaction, StatsTransactions as Donnees,
} from "@lehno/contracts";

export interface StatsTransactionsProps {
  langue?: Langue;
  donnees: Donnees;
  /**
   * La coupe DEMANDÉE, distincte de celle que la réponse rend.
   *
   * Les sélecteurs doivent refléter l'intention tout de suite ; les chiffres
   * ont le droit d'être en retard. Lus dans la réponse, ils revenaient à
   * l'ancienne valeur le temps de l'aller-retour — et un second changement
   * repartait alors de l'état d'avant, effaçant le premier.
   */
  coupe: { periode: PeriodeTransactions; sens: SensTransaction; mode: ModeTransaction };
  onCoupe: (coupe: {
    periode: PeriodeTransactions; sens: SensTransaction; mode: ModeTransaction;
  }) => void;
  onRetour?: (id?: string) => void;
}

type LigneGroupe = Aboutissement & { id: string; libelle: string; taux: string };

/**
 * Ce qui est encaissé, ce que ça coûte, ce qui n'aboutit pas.
 *
 * **Les quatre chiffres suivent la coupe, comme le graphe.** Une carte figée à
 * côté d'un graphe qui bouge ment dès le premier changement de période — et
 * personne ne s'en aperçoit, puisque les deux ont l'air d'aller ensemble.
 *
 * **La mention sous le titre nomme la coupe active.** Sans elle, le graphe
 * cesse de dire ce qu'il montre dès qu'on a touché un axe.
 */
export function StatsTransactions({
  langue = "fr", donnees, coupe, onCoupe, onRetour,
}: StatsTransactionsProps): ReactNode {
  const t = messages(langue);
  const d = t.transactionsStats;
  const nombre = new Intl.NumberFormat(langue === "fr" ? "fr-FR" : "en-GB");
  const argent = (v: number) => `${nombre.format(Math.round(v))} ${d.devise}`;

  /* Un ratio plutôt qu'un pourcentage : « un sur douze échoue » se retient,
     « 8 % » se survole. Et quand rien n'échoue, on le dit — « un sur l'infini »
     n'est pas une phrase. */
  const echecs = donnees.tentatives - donnees.aboutis;
  const ratio = echecs === 0
    ? d.cartes.aucunEchec
    : d.cartes.aboutisRatio.replace("{n}", nombre.format(Math.round(donnees.tentatives / echecs)));

  const groupes = (lignes: Aboutissement[], libelle: (cle: string) => string): LigneGroupe[] =>
    lignes.map((a) => ({
      ...a,
      id: a.cle,
      libelle: libelle(a.cle),
      // Le taux se calcule sur des tentatives : sans elles, il n'y a pas de
      // taux — et « 0 % » se lirait « rien n'aboutit ».
      taux: a.tentatives === 0 ? "—" : `${Math.round((a.aboutis / a.tentatives) * 100)} %`,
    }));

  const colonnes: Colonne<LigneGroupe>[] = [
    { cle: "libelle", titre: d.col.groupe },
    { cle: "tentatives", titre: d.col.tentatives, aligne: "right", rendu: (l) => nombre.format(l.tentatives) },
    { cle: "aboutis", titre: d.col.aboutis, aligne: "right", rendu: (l) => nombre.format(l.aboutis) },
    { cle: "taux", titre: d.col.taux, aligne: "right" },
  ];

  const table = (lignes: LigneGroupe[]) => (
    <DataTable colonnes={colonnes} lignes={lignes} vide={<EmptyState titre={d.vide} />} />
  );

  const moyen = (cle: string) =>
    (d.moyens as Record<string, string>)[cle] ?? cle;

  return (
    <>
      <Breadcrumb
        racine={{ id: "tableau", label: t.fil.accueil }}
        items={[{ label: d.titre }]}
        libelle={t.fil.libelle}
        onNavigate={(id) => onRetour?.(id)}
      />

      <PageHeader titre={d.titre} sous={d.sous} />

      <FilterBar
        filtres={[
          {
            cle: "periode", label: d.graphe.periodeLabel, valeur: donnees.periode,
            options: (["7j", "30j", "90j"] as const).map((v) => ({ value: v, label: d.graphe.periodes[v] })),
            onChange: (e) => onCoupe({
              periode: e.target.value as PeriodeTransactions, sens: coupe.sens, mode: coupe.mode,
            }),
          },
          {
            cle: "sens", label: d.graphe.typeLabel, valeur: donnees.sens,
            options: (["tous", "depot", "retrait"] as const).map((v) => ({ value: v, label: d.graphe.types[v] })),
            onChange: (e) => onCoupe({
              periode: coupe.periode, sens: e.target.value as SensTransaction, mode: coupe.mode,
            }),
          },
          {
            cle: "mode", label: d.graphe.modeLabel, valeur: donnees.mode,
            options: (["tous", "auto", "manuel"] as const).map((v) => ({ value: v, label: d.graphe.modes[v] })),
            onChange: (e) => onCoupe({
              periode: coupe.periode, sens: coupe.sens, mode: e.target.value as ModeTransaction,
            }),
          },
        ]}
      />

      <section className="admin-section" aria-labelledby="stats-chiffres">
        <h2 id="stats-chiffres" className="admin-section-titre">{d.graphe.titre}</h2>
        <div className="admin-section-cartes">
          <StatCard valeur={nombre.format(donnees.aboutis)} libelle={d.cartes.aboutis} variation={ratio} />
          <StatCard valeur={argent(donnees.encaisse)} libelle={d.cartes.encaisse} />
          <StatCard valeur={argent(donnees.frais)} libelle={d.cartes.frais} />
          <StatCard
            valeur={donnees.median === null ? d.cartes.sansPanier : argent(donnees.median)}
            libelle={d.cartes.panier}
          />
        </div>
      </section>

      <section className="admin-section" aria-labelledby="stats-graphe">
        <h2 id="stats-graphe" className="admin-section-titre">{d.graphe.titre}</h2>
        <p className="admin-section-sous">
          {d.graphe.coupe
            .replace("{periode}", d.graphe.periodes[donnees.periode])
            .replace("{sens}", d.graphe.types[donnees.sens])
            .replace("{mode}", d.graphe.modes[donnees.mode])}
        </p>
        <GrapheJours
          jours={donnees.jours.map((j) => ({ jour: j.jour, haut: j.encaisse, bas: j.echoue }))}
          libelles={{
            resume: d.graphe.titre,
            haut: d.graphe.encaisse,
            bas: d.graphe.echoue,
            jour: d.graphe.jour,
            vide: d.graphe.vide,
          }}
          format={argent}
        />
      </section>

      <section className="admin-section" aria-labelledby="stats-moyens">
        <h2 id="stats-moyens" className="admin-section-titre">{d.parMoyen}</h2>
        <p className="admin-section-sous">{d.noteMoyen}</p>
        {table(groupes(donnees.parMoyen, moyen))}
      </section>

      <section className="admin-section" aria-labelledby="stats-pays">
        <h2 id="stats-pays" className="admin-section-titre">{d.parPays}</h2>
        <p className="admin-section-sous">{d.notePays}</p>
        {/* Le pays reste son code : la liste des noms vit chez qui la traduit,
            et un code inconnu s'affiche tel quel, ce qui se voit. */}
        {table(groupes(donnees.parPays, (cle) => cle))}
      </section>
    </>
  );
}

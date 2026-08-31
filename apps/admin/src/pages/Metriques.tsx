import type { ReactNode } from "react";
import { PageHeader } from "../composants/page/index.js";
import { DataTable, EmptyState, FilterBar, type Colonne } from "../composants/donnees/index.js";
import { StatCard } from "../composants/signaux/index.js";
import { ExportButton } from "../composants/actions/index.js";
import { messages, type Langue } from "../i18n/index.js";
import type { ActionPayante, Metriques as Donnees, PeriodeMetriques } from "@lehno/contracts";

/**
 * L'usage au-delà des chiffres du tableau de bord (ux-admin §5.11).
 *
 * Ce que cet écran **ne montre pas**, et le dit : trois des cinq contenus que
 * la section demande n'ont pas de source dans ce dépôt. Le marquage part vers
 * l'outil d'analyse sans rien conserver ici, le registre des exécutions
 * n'existe pas, et les surfaces qui produisent des contributions non plus.
 *
 * Ils sont **nommés**, plutôt que rendus en rangs à zéro. Un zéro sans
 * explication se prend pour une mesure — c'est ainsi que quatre écrans ont
 * affiché des fixtures en production (écarts, H).
 *
 * La liste vient du serveur : le jour où une source arrive, il cesse de la
 * déclarer et cette page suit, sans qu'on ait à venir décrocher un
 * avertissement écrit ici.
 */
export interface MetriquesProps {
  langue?: Langue;
  donnees: Donnees;
  periode: PeriodeMetriques;
  onPeriode: (periode: PeriodeMetriques) => void;
  /** Absent pour le support : voir une liste et pouvoir la sortir sont deux
   *  choses, et le serveur refuse la seconde. On ne montre pas un geste qu'il
   *  refuserait. */
  onExporter?: () => void;
  exportEnCours?: boolean;
}

/** Un rang de la page : son titre nomme la région pour les technologies
 *  d'assistance — quatre rangs sans nom ne se distinguent qu'à l'œil. */
function Rang({ id, titre, sous, children }: { id: string; titre: string; sous?: string; children: ReactNode }) {
  return (
    <section className="admin-section" aria-labelledby={id}>
      <h2 id={id} className="admin-section-titre">{titre}</h2>
      {sous ? <p className="admin-section-sous">{sous}</p> : null}
      {children}
    </section>
  );
}

type LigneCohorte = { id: string; mois: string; inscrits: number; actifsA7j: number; actifsA30j: number };
type LignePalier = { id: string; palier: string; achats: number };
type LigneAction = ActionPayante & { id: string; libelle: string; taux: string };

export function Metriques({
  langue = "fr", donnees, periode, onPeriode, onExporter, exportEnCours,
}: MetriquesProps): ReactNode {
  const t = messages(langue);
  const nombre = new Intl.NumberFormat(langue === "fr" ? "fr-FR" : "en-GB");

  const cohortes: LigneCohorte[] = donnees.retention.cohortes.map((c) => ({ id: c.mois, ...c }));

  const colonnesCohortes: Colonne<LigneCohorte>[] = [
    { cle: "mois", titre: t.metriques.retention.col.mois, largeur: 150 },
    { cle: "inscrits", titre: t.metriques.retention.col.inscrits, aligne: "right", rendu: (c) => nombre.format(c.inscrits) },
    { cle: "actifsA7j", titre: t.metriques.retention.col.a7, aligne: "right", rendu: (c) => nombre.format(c.actifsA7j) },
    { cle: "actifsA30j", titre: t.metriques.retention.col.a30, aligne: "right", rendu: (c) => nombre.format(c.actifsA30j) },
  ];

  const paliers: LignePalier[] = donnees.conversion.parPalier.map((p) => ({
    id: String(p.credits),
    palier: t.metriques.conversion.credits.replace("{n}", nombre.format(p.credits)),
    achats: p.achats,
  }));

  const colonnesPaliers: Colonne<LignePalier>[] = [
    { cle: "palier", titre: t.metriques.conversion.colPalier },
    { cle: "achats", titre: t.metriques.conversion.colAchats, aligne: "right", rendu: (p) => nombre.format(p.achats) },
  ];

  /* Le libellé d'une action vit dans le dictionnaire, indexé par son code —
     le serveur transporte des clés, jamais des phrases composées. Un code
     inconnu s'affiche tel quel : ça se voit, là où un libellé vide se
     confondrait avec une ligne cassée. */
  const libelleAction = (code: string): string =>
    (t.metriques.actionsPayantes.codes as Record<string, string>)[code] ?? code;

  /* Aucun lancement ne donne pas « 0 % » : c'est un taux qui n'a rien à
     mesurer. Zéro pour cent se lirait « rien n'échoue », ce qui est une
     mesure — et c'est faux tant que rien n'a tourné. */
  const taux = (a: ActionPayante): string =>
    a.lancements === 0
      ? t.metriques.actionsPayantes.sansTaux
      : `${Math.round((a.echouees / a.lancements) * 100)} %`;

  const actions: LigneAction[] = donnees.actions.map((a) => ({
    ...a, id: a.code, libelle: libelleAction(a.code), taux: taux(a),
  }));

  const colonnesActions: Colonne<LigneAction>[] = [
    { cle: "libelle", titre: t.metriques.actionsPayantes.col.action },
    { cle: "lancements", titre: t.metriques.actionsPayantes.col.lancements, aligne: "right", rendu: (a) => nombre.format(a.lancements) },
    { cle: "reussies", titre: t.metriques.actionsPayantes.col.reussies, aligne: "right", rendu: (a) => nombre.format(a.reussies) },
    { cle: "echouees", titre: t.metriques.actionsPayantes.col.echouees, aligne: "right", rendu: (a) => nombre.format(a.echouees) },
    { cle: "enAttente", titre: t.metriques.actionsPayantes.col.enAttente, aligne: "right", discret: true, rendu: (a) => nombre.format(a.enAttente) },
    { cle: "taux", titre: t.metriques.actionsPayantes.col.echec, aligne: "right" },
  ];

  // Nul et zéro ne disent pas la même chose : personne n'a acheté, ou tout le
  // monde achète le jour même. Le contrat les distingue ; l'écran doit suivre,
  // sans quoi la distinction ne sert à rien.
  const delai = donnees.conversion.delaiMedianJours === null
    ? t.metriques.conversion.sansDelai
    : t.metriques.conversion.jours.replace("{n}", nombre.format(donnees.conversion.delaiMedianJours));

  return (
    <>
      <PageHeader
        titre={t.metriques.titre}
        sous={t.metriques.sous}
        {...(onExporter
          ? {
            actions: (
              <ExportButton
                formats={["csv"]}
                onExport={() => onExporter()}
                {...(exportEnCours ? { etat: "encours" as const } : {})}
                libelles={{
                  exporter: t.exporter.bouton,
                  encours: t.exporter.encours,
                  formats: { csv: t.exporter.formatCsv },
                  journal: t.exporter.journal,
                }}
              />
            ),
          }
          : {})}
      />

      <FilterBar
        filtres={[{
          cle: "periode",
          label: t.metriques.periode,
          valeur: periode,
          options: [
            { value: "7j", label: t.metriques.periodes.j7 },
            { value: "30j", label: t.metriques.periodes.j30 },
            { value: "90j", label: t.metriques.periodes.j90 },
            { value: "12m", label: t.metriques.periodes.m12 },
          ],
          onChange: (e) => onPeriode(e.target.value as PeriodeMetriques),
        }]}
      />

      <Rang id="rang-retention" titre={t.metriques.retention.titre} sous={t.metriques.retention.sous}>
        <DataTable
          colonnes={colonnesCohortes}
          lignes={cohortes}
          vide={<EmptyState titre={t.metriques.retention.vide} />}
        />
      </Rang>

      <Rang id="rang-conversion" titre={t.metriques.conversion.titre} sous={t.metriques.conversion.sous}>
        <div className="admin-section-cartes">
          <StatCard valeur={nombre.format(donnees.conversion.comptes)} libelle={t.metriques.conversion.comptes} />
          <StatCard valeur={nombre.format(donnees.conversion.acheteurs)} libelle={t.metriques.conversion.acheteurs} />
          <StatCard valeur={delai} libelle={t.metriques.conversion.delai} />
        </div>
        <DataTable
          colonnes={colonnesPaliers}
          lignes={paliers}
          vide={<EmptyState titre={t.metriques.conversion.sansPalier} />}
        />
      </Rang>

      <Rang
        id="rang-actions"
        titre={t.metriques.actionsPayantes.titre}
        sous={t.metriques.actionsPayantes.sous}
      >
        <DataTable
          colonnes={colonnesActions}
          lignes={actions}
          vide={<EmptyState titre={t.metriques.actionsPayantes.vide} />}
        />
      </Rang>

      <Rang id="rang-consommation" titre={t.metriques.consommation.titre}>
        <div className="admin-section-cartes">
          <StatCard valeur={nombre.format(donnees.consommation.credits)} libelle={t.metriques.consommation.credits} />
          <StatCard valeur={nombre.format(donnees.consommation.mouvements)} libelle={t.metriques.consommation.mouvements} />
        </div>
      </Rang>

      {donnees.manques.length > 0 ? (
        <Rang id="rang-manques" titre={t.metriques.manques.titre} sous={t.metriques.manques.sous}>
          <ul className="admin-manques">
            {donnees.manques.map((manque) => (
              <li key={manque}>
                <strong>{t.metriques.manques[manque].quoi}</strong>
                <span>{t.metriques.manques[manque].bloque}</span>
              </li>
            ))}
          </ul>
        </Rang>
      ) : null}
    </>
  );
}

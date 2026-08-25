import type { ReactNode } from "react";
import type { Dashboard } from "@lehno/contracts";

import { PageHeader } from "../composants/page/index.js";
import { AlertPill, StatCard, type AlertPillProps, type StatCardProps, type TonAlerte } from "../composants/signaux/index.js";
import { DataTable, EmptyState, StatusPill, type Colonne } from "../composants/donnees/index.js";
import type { Messages } from "../i18n/index.js";

/** Une entrée de la file « à traiter ». Le contrat n'en nomme pas le type :
 *  il n'existe que dans le tableau de bord, et se lit depuis lui. */
type ATraiter = Dashboard["aTraiter"][number];

/** « Trois AlertPill au plus, sur une ligne. » Le plafond vit d'abord dans
 *  `dashboardSchema`, qui refuse une quatrième alerte ; l'écran ne doit pas
 *  pouvoir le contredire si une source non validée — une API pas encore
 *  alignée — en rendait davantage. Une quatrième pastille casserait la ligne,
 *  et surtout : au-delà de trois, ce n'est plus une alerte, c'est une liste. */
const PLAFOND_ALERTES = 3;

/** Le contrat dit la gravité (`danger`, `attention`) ; la pastille dit la
 *  nature (ce qui ne va pas, un délai qui court). La correspondance se fait
 *  ici, une fois, plutôt qu'à chaque appel. */
const TONS: Record<Dashboard["alertes"][number]["ton"], TonAlerte> = {
  danger: "alerte",
  attention: "echeance",
};

export interface TableauDeBordProps {
  donnees: Dashboard;
  /** La table de messages de la langue de lecture : la page n'a pas un mot à elle. */
  t: Messages;
  /** Une alerte et un chiffre mènent à la section qui les explique. */
  onAller: (section: string) => void;
}

/** Un rang du tableau de bord : son titre, et ce qu'il porte. Le titre nomme la
 *  région pour les technologies d'assistance — trois rangs sans nom ne se
 *  distinguent qu'à l'œil. */
function Rang({ id, titre, children }: { id: string; titre: string; children: ReactNode }) {
  return (
    <section className="admin-accueil-rang" aria-labelledby={id}>
      <h2 id={id} className="admin-accueil-titre">
        {titre}
      </h2>
      {children}
    </section>
  );
}

/** Le tableau de bord du back-office. Il ne demande rien et ne modifie rien :
 *  il dit **ce qui ne va pas avant tout chiffre**, puis les chiffres, puis ce
 *  qui attend une décision. C'est l'ordre de lecture d'une prise de poste.
 *
 *  Une alerte qui a déjà déclenché un courriel porte son rappel — « notifié à
 *  14 h ». L'écran et le mail sont deux vues d'un même événement : on ne
 *  prévient pas deux fois pour la même cause tant que la pastille est là. */
export function TableauDeBord({ donnees, t, onAller }: TableauDeBordProps) {
  const colonnes: Colonne<ATraiter>[] = [
    { cle: "element", titre: t.tableau.col.element },
    { cle: "section", titre: t.tableau.col.section, discret: true, largeur: "24%" },
    {
      cle: "etat",
      titre: t.tableau.col.etat,
      largeur: 150,
      // Tout ce qui est dans cette file attend une décision : le contrat ne
      // porte pas de gravité par ligne, et en inventer une donnerait du rouge
      // à ce qui n'est qu'en attente.
      rendu: (ligne) => <StatusPill ton="attente">{ligne.etat}</StatusPill>,
    },
    { cle: "depuis", titre: t.tableau.col.depuis, discret: true, aligne: "right", largeur: 110 },
  ];

  return (
    <>
      <PageHeader titre={t.tableau.titre} sous={t.tableau.sous} />

      <Rang id="tdb-alertes" titre={t.tableau.alertesTitre}>
        {donnees.alertes.length === 0 ? (
          <EmptyState titre={t.tableau.alertesVide.titre} texte={t.tableau.alertesVide.texte} />
        ) : (
          <div className="admin-accueil-alertes">
            {donnees.alertes.slice(0, PLAFOND_ALERTES).map((a) => {
              const props: AlertPillProps = {
                children: a.libelle,
                ton: TONS[a.ton],
                onClick: () => onAller(a.section),
                ...(a.notifieA ? { notifie: t.alerte.notifie.replace("{heure}", a.notifieA) } : {}),
              };
              return <AlertPill key={a.id} {...props} />;
            })}
          </div>
        )}
      </Rang>

      <Rang id="tdb-indicateurs" titre={t.tableau.indicateursTitre}>
        <div className="admin-accueil-indicateurs">
          {donnees.indicateurs.map((i) => {
            // Un chiffre qui ne mène nulle part reste une carte : en faire un
            // bouton promettrait un écran qui n'existe pas.
            const section = i.section;
            const props: StatCardProps = {
              libelle: i.libelle,
              valeur: i.valeur,
              ...(i.variation ? { variation: i.variation.texte, sens: i.variation.sens } : {}),
              ...(section ? { onClick: () => onAller(section) } : {}),
            };
            return <StatCard key={i.id} {...props} />;
          })}
        </div>
      </Rang>

      <Rang id="tdb-a-traiter" titre={t.tableau.aTraiterTitre}>
        <DataTable
          colonnes={colonnes}
          lignes={donnees.aTraiter}
          // « Chaque élément à traiter mène directement à la section
          // concernée » (ux-admin §5.2). Ce n'est pas un raccourci de confort :
          // les files du délai de grâce, de la modération et des messages ne
          // figurent pas au menu — c'est par ici qu'on y entre.
          onOuvrir={(ligne) => onAller(ligne.section)}
          vide={<EmptyState titre={t.tableau.vide.titre} texte={t.tableau.vide.texte} />}
        />
      </Rang>
    </>
  );
}

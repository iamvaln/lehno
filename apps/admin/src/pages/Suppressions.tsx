import { useMemo, useState, type ReactNode } from "react";
import type { AdminRole, DemandeSuppression } from "@lehno/contracts";
import { PageHeader } from "../composants/page/index.js";
import {
  DataTable,
  EmptyState,
  FilterBar,
  StatusPill,
  type ActionLigne,
  type Colonne,
  type EtatTri,
  type TonPastille,
} from "../composants/donnees/index.js";
import { ConfirmWithReason } from "../composants/actions/index.js";
import { Toast } from "../composants/signaux/index.js";
import { messages, type Langue } from "../i18n/index.js";
import { suppressions as suppressionsDemo } from "../fixtures/index.js";

/* Demandes de suppression — le gabarit de liste, plus les deux gestes du délai
 * de grâce : **restaurer**, et **effacer sans attendre**.
 *
 * Les deux passent par `ConfirmWithReason` : toute action qui change un état
 * exige un motif, sans exception, et c'est ce motif qui fait que le journal
 * d'audit dit quelque chose. Effacer sans attendre est irréversible et coupe le
 * délai : c'est de l'administrateur seul, et le support ne le voit pas.
 */

type EtatDemande = DemandeSuppression["etat"];
type FiltreEtat = EtatDemande | "tous";
type Geste = "restaurer" | "effacer";

interface LigneDemande extends DemandeSuppression {
  demandeeTexte: string;
  echeanceTexte: string;
  restantTexte: string;
  etatLibelle: string;
  ton: TonPastille;
}

const TON_ETAT: Record<EtatDemande, TonPastille> = {
  en_cours: "attente",
  echue: "arrete",
  /* Ni l'ambre de l'attente, ni le rouge de « à effacer ».
     Le rouge dirait que l'heure est venue de vider le compte — c'est exactement
     la confusion à écarter, puisque l'effacement est RETENU. L'ambre dirait
     qu'on attend une date, alors qu'on attend un virement de notre part.
     Le violet les distingue des deux sans annoncer ni l'un ni l'autre. */
  attend_remboursement: "info",
};

/* Le libellé se lit dans le dictionnaire, indexé par l'état — plutôt qu'un
   ternaire qui grandit d'une branche à chaque état ajouté, et dont on oublie
   la dernière. */
const CLE_LIBELLE: Record<EtatDemande, "enCours" | "echue" | "attendRemboursement"> = {
  en_cours: "enCours",
  echue: "echue",
  attend_remboursement: "attendRemboursement",
};

export interface SuppressionsProps {
  role: AdminRole;
  langue?: Langue;
  demandes?: DemandeSuppression[];
  onRestaurer?: (demande: DemandeSuppression, motif: string) => void;
  onEffacer?: (demande: DemandeSuppression, motif: string) => void;
}

export function Suppressions({
  role,
  langue = "fr",
  demandes = suppressionsDemo.items,
  onRestaurer,
  onEffacer,
}: SuppressionsProps): ReactNode {
  const t = messages(langue);
  const [recherche, setRecherche] = useState("");
  const [filtreEtat, setFiltreEtat] = useState<FiltreEtat>("tous");
  // Ce qui arrive à échéance passe devant : c'est l'ordre dans lequel on traite.
  const [tri, setTri] = useState<EtatTri>({ cle: "echeance", sens: "asc" });
  const [geste, setGeste] = useState<{ id: Geste; demande: DemandeSuppression } | null>(null);
  const [accuse, setAccuse] = useState<string | null>(null);

  const date = useMemo(
    () => new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", year: "numeric" }),
    [langue],
  );

  const filtre = recherche !== "" || filtreEtat !== "tous";

  const restant = (jours: number) => {
    if (jours <= 0) return t.suppressions.restantZero;
    if (jours === 1) return t.suppressions.restantUn;
    return t.suppressions.restantN.replace("{n}", String(jours));
  };

  // La page filtre et ordonne ; le tableau rend ce qu'on lui donne.
  const trouvees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const retenues = demandes.filter((demande) => {
      if (filtreEtat !== "tous" && demande.etat !== filtreEtat) return false;
      return q === "" || demande.compte.toLowerCase().includes(q);
    });

    const sens = tri.sens === "asc" ? 1 : -1;
    return [...retenues].sort((a, b) => {
      if (tri.cle === "joursRestants") return (a.joursRestants - b.joursRestants) * sens;
      const va = tri.cle === "compte" ? a.compte : tri.cle === "demandeeLe" ? a.demandeeLe : a.echeance;
      const vb = tri.cle === "compte" ? b.compte : tri.cle === "demandeeLe" ? b.demandeeLe : b.echeance;
      return va.localeCompare(vb, langue) * sens;
    });
  }, [demandes, recherche, filtreEtat, tri, langue]);

  const lignes: LigneDemande[] = trouvees.map((demande) => ({
    ...demande,
    demandeeTexte: date.format(new Date(demande.demandeeLe)),
    echeanceTexte: date.format(new Date(demande.echeance)),
    restantTexte: restant(demande.joursRestants),
    etatLibelle: t.suppressions.etats[CLE_LIBELLE[demande.etat]],
    ton: TON_ETAT[demande.etat],
  }));

  const colonnes: Colonne<LigneDemande>[] = [
    { cle: "compte", titre: t.suppressions.col.compte, triable: true },
    {
      cle: "demandeeLe",
      titre: t.suppressions.col.demandee,
      triable: true,
      discret: true,
      largeur: 150,
      rendu: (ligne) => ligne.demandeeTexte,
    },
    {
      cle: "echeance",
      titre: t.suppressions.col.echeance,
      triable: true,
      largeur: 150,
      rendu: (ligne) => ligne.echeanceTexte,
    },
    {
      cle: "joursRestants",
      titre: t.suppressions.col.restant,
      triable: true,
      aligne: "right",
      largeur: 140,
      rendu: (ligne) => ligne.restantTexte,
    },
    {
      cle: "etat",
      titre: t.suppressions.col.etat,
      largeur: 150,
      rendu: (ligne) => <StatusPill ton={ligne.ton}>{ligne.etatLibelle}</StatusPill>,
    },
  ];

  // Restaurer reste ouvert au support : c'est le geste réversible. Effacer sans
  // attendre est retiré, pas grisé — un bouton désactivé promettrait un droit.
  const actions = (): ActionLigne[] => {
    const liste: ActionLigne[] = [{ id: "restaurer", label: t.suppressions.restaurer }];
    if (role === "admin") liste.push({ id: "effacer", label: t.suppressions.effacer, danger: true });
    return liste;
  };

  const dialogue = geste
    ? geste.id === "effacer"
      ? t.suppressions.dialogueEffacer
      : t.suppressions.dialogueRestaurer
    : null;

  const confirmer = (motif: string) => {
    if (!geste) return;
    if (geste.id === "effacer") {
      onEffacer?.(geste.demande, motif);
      setAccuse(t.suppressions.faits.efface.replace("{motif}", motif));
    } else {
      onRestaurer?.(geste.demande, motif);
      setAccuse(t.suppressions.faits.restaure.replace("{motif}", motif));
    }
    setGeste(null);
  };

  const resultats = trouvees.length > 1
    ? t.table.resultatsN.replace("{n}", String(trouvees.length))
    : t.table.resultatUn;

  return (
    <>
      <PageHeader titre={t.suppressions.titre} sous={t.suppressions.sous} />

      <FilterBar
        recherche={recherche}
        onRecherche={(e) => setRecherche(e.target.value)}
        placeholder={t.suppressions.recherche}
        filtres={[
          {
            cle: "etat",
            label: t.suppressions.filtreEtat,
            valeur: filtreEtat,
            onChange: (e) => setFiltreEtat(e.target.value as FiltreEtat),
            options: [
              { value: "tous", label: t.suppressions.tousEtats },
              { value: "en_cours", label: t.suppressions.etats.enCours },
              { value: "echue", label: t.suppressions.etats.echue },
            ],
          },
        ]}
        resultats={resultats}
        {...(filtre
          ? {
              onReinitialiser: () => {
                setRecherche("");
                setFiltreEtat("tous");
              },
              reinitialiser: t.table.reinitialiser,
            }
          : {})}
      />

      <DataTable
        colonnes={colonnes}
        lignes={lignes}
        tri={tri}
        onTri={(cle) =>
          setTri((courant) => ({ cle, sens: courant.cle === cle && courant.sens === "asc" ? "desc" : "asc" }))
        }
        actions={actions}
        onAction={(id, ligne) => setGeste({ id: id as Geste, demande: ligne })}
        nom={(ligne) => ligne.compte}
        libelles={{
          toutSelectionner: t.table.toutSelectionner,
          selectionner: t.table.selectionner,
          actions: t.table.actions,
        }}
        vide={<EmptyState titre={t.suppressions.vide.titre} texte={t.suppressions.vide.texte} />}
      />

      {geste && dialogue ? (
        <ConfirmWithReason
          destructif={geste.id === "effacer"}
          titre={dialogue.titre.replace("{compte}", geste.demande.compte)}
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

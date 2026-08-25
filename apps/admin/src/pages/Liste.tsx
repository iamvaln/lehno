import { useMemo, useState, type ReactNode } from "react";
import type { AdminRole, CompteLigne } from "@lehno/contracts";
import { PageHeader } from "../composants/page/index.js";
import {
  DataTable,
  EmptyState,
  FilterBar,
  Pagination,
  StatusPill,
  type ActionLigne,
  type Colonne,
  type EtatTri,
  type TonPastille,
} from "../composants/donnees/index.js";
import { ConfirmWithReason, ExportButton, RoleGate } from "../composants/actions/index.js";
import { Toast } from "../composants/signaux/index.js";
import { messages, type Langue, type Messages } from "../i18n/index.js";
import { comptes as comptesDemo } from "../fixtures/index.js";

/* Le gabarit de liste — l'archétype des quinze sections, monté ici sur sa
 * section pilote : Utilisateurs.
 *
 * La règle qui gouverne ce fichier : **la page trie et découpe, le tableau
 * non**. `DataTable` affiche les lignes dans l'ordre où on les lui donne et
 * remonte `onTri(cle)` ; c'est ici qu'on ordonne, qu'on filtre et qu'on coupe la
 * tranche visible. Le jour où l'API arrive, ces trois gestes deviennent des
 * paramètres de requête — l'écran, lui, ne bouge pas.
 */

type EtatCompte = CompteLigne["etat"];
type FiltreEtat = EtatCompte | "tous";
type FiltreSolde = "tous" | "zero" | "positif";
type Geste = "ajuster" | "suspendre" | "retablir";

/** La ligne rendue : le compte, plus ce que la langue en fait. */
interface LigneCompte extends CompteLigne {
  etatLibelle: string;
  inscritTexte: string;
  ton: TonPastille;
}

// L'état d'un compte se dit dans la langue de l'outil, et se teinte par son ton :
// ni la couleur ni le mot ne vivent dans le contrat, qui ne porte qu'une clé.
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

const TAILLES = [10, 25, 50];

export interface ListeProps {
  role: AdminRole;
  langue?: Langue;
  /** Les comptes à rendre. Sans serveur, ce sont les fixtures validées. */
  comptes?: CompteLigne[];
  /** Taille de page initiale. */
  parPage?: number;
  onOuvrir?: (compte: CompteLigne) => void;
  onSuspendre?: (compte: CompteLigne, motif: string) => void;
  onRetablir?: (compte: CompteLigne, motif: string) => void;
  onAjuster?: (compte: CompteLigne, motif: string) => void;
  onExporter?: (format: string) => void;
}

function valeurTriee(compte: CompteLigne, cle: string): string | number {
  // Un solde inconnu se range au fond plutôt qu'en tête : sans mesure, mieux
  // vaut ne pas prétendre qu'il vaut zéro.
  if (cle === "credits") return compte.credits ?? Number.NEGATIVE_INFINITY;
  if (cle === "pseudo") return compte.pseudo;
  if (cle === "email") return compte.email;
  return compte.inscritLe;
}

export function Liste({
  role,
  langue = "fr",
  comptes = comptesDemo.items,
  parPage: parPageInitial = 10,
  onOuvrir,
  onSuspendre,
  onRetablir,
  onAjuster,
  onExporter,
}: ListeProps): ReactNode {
  const t = messages(langue);
  const [recherche, setRecherche] = useState("");
  const [filtreEtat, setFiltreEtat] = useState<FiltreEtat>("tous");
  const [filtreSolde, setFiltreSolde] = useState<FiltreSolde>("tous");
  const [tri, setTri] = useState<EtatTri>({ cle: "inscritLe", sens: "desc" });
  const [parPage, setParPage] = useState(parPageInitial);
  const [page, setPage] = useState(0);
  const [geste, setGeste] = useState<{ id: Geste; compte: CompteLigne } | null>(null);
  const [accuse, setAccuse] = useState<string | null>(null);

  const date = useMemo(
    () => new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", year: "numeric" }),
    [langue],
  );

  const filtre = recherche !== "" || filtreEtat !== "tous" || filtreSolde !== "tous";

  const remiseAZero = () => {
    setRecherche("");
    setFiltreEtat("tous");
    setFiltreSolde("tous");
    setPage(0);
  };

  // Filtrer, puis ordonner : les deux gestes que le tableau ne fait pas.
  const trouves = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const retenus = comptes.filter((compte) => {
      if (filtreEtat !== "tous" && compte.etat !== filtreEtat) return false;
      // Un solde qu'on ne connaît pas ne satisfait aucun filtre de solde : il
      // n'est ni nul ni positif, et le compter dans l'un ou l'autre ferait
      // passer une lacune de la base pour un fait sur le compte.
      if (filtreSolde !== "tous" && compte.credits === null) return false;
      if (filtreSolde === "zero" && compte.credits !== 0) return false;
      if (filtreSolde === "positif" && (compte.credits ?? 0) <= 0) return false;
      if (q === "") return true;
      return `${compte.pseudo} ${compte.email}`.toLowerCase().includes(q);
    });

    const sens = tri.sens === "asc" ? 1 : -1;
    return [...retenus].sort((a, b) => {
      const va = valeurTriee(a, tri.cle);
      const vb = valeurTriee(b, tri.cle);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sens;
      return String(va).localeCompare(String(vb), langue) * sens;
    });
  }, [comptes, recherche, filtreEtat, filtreSolde, tri, langue]);

  // Découper : la page courante est bornée, parce qu'un filtre resserré peut
  // laisser un curseur au-delà de la dernière page.
  const dernierePage = Math.max(0, Math.ceil(trouves.length / parPage) - 1);
  const courante = Math.min(page, dernierePage);
  const tranche = trouves.slice(courante * parPage, courante * parPage + parPage);

  const lignes: LigneCompte[] = tranche.map((compte) => ({
    ...compte,
    etatLibelle: t.etats[LIBELLE_ETAT[compte.etat]],
    inscritTexte: date.format(new Date(compte.inscritLe)),
    ton: TON_ETAT[compte.etat],
  }));

  const colonnes: Colonne<LigneCompte>[] = [
    { cle: "pseudo", titre: t.comptes.col.pseudo, triable: true },
    { cle: "email", titre: t.comptes.col.email, discret: true },
    {
      cle: "etat",
      titre: t.comptes.col.etat,
      largeur: 150,
      rendu: (ligne) => <StatusPill ton={ligne.ton}>{ligne.etatLibelle}</StatusPill>,
    },
    { cle: "credits", titre: t.comptes.col.credits, triable: true, aligne: "right", largeur: 90 },
    {
      cle: "inscritLe",
      titre: t.comptes.col.inscrit,
      triable: true,
      discret: true,
      aligne: "right",
      largeur: 150,
      rendu: (ligne) => ligne.inscritTexte,
    },
  ];

  // Le rôle retire : le support ouvre un compte, il n'engage rien dessus.
  const actions = (ligne: LigneCompte): ActionLigne[] => {
    const liste: ActionLigne[] = [{ id: "ouvrir", label: t.comptes.actions.ouvrir }];
    if (role !== "admin") return liste;
    liste.push({ id: "ajuster", label: t.comptes.actions.ajuster });
    liste.push(
      ligne.etat === "suspendu"
        ? { id: "retablir", label: t.comptes.actions.retablir }
        : { id: "suspendre", label: t.comptes.actions.suspendre, danger: true },
    );
    return liste;
  };

  const surAction = (id: string, ligne: LigneCompte) => {
    if (id === "ouvrir") return onOuvrir?.(ligne);
    setGeste({ id: id as Geste, compte: ligne });
  };

  const dialogue = geste ? t.comptes[geste.id] : null;

  const confirmer = (motif: string) => {
    if (!geste) return;
    const rappel = { compte: geste.compte, motif };
    if (geste.id === "suspendre") onSuspendre?.(rappel.compte, rappel.motif);
    if (geste.id === "retablir") onRetablir?.(rappel.compte, rappel.motif);
    if (geste.id === "ajuster") onAjuster?.(rappel.compte, rappel.motif);
    setAccuse(t.comptes.faits[geste.id].replace("{motif}", motif));
    setGeste(null);
  };

  const portee = t.exporter.porteeResultats.replace("{n}", String(trouves.length));
  const resultats = trouves.length > 1
    ? t.table.resultatsN.replace("{n}", String(trouves.length))
    : t.table.resultatUn;

  return (
    <>
      <PageHeader
        titre={t.comptes.titre}
        sous={t.comptes.sous}
        actions={
          <RoleGate role={role} autorise="admin">
            <ExportButton
              formats={["csv", "json"]}
              portee={portee}
              libelles={{
                exporter: t.exporter.bouton,
                avecPortee: t.exporter.avecPortee,
                encours: t.exporter.encours,
                formats: { csv: t.exporter.formatCsv, json: t.exporter.formatJson },
                journal: t.exporter.journal,
              }}
              onExport={(format) => {
                onExporter?.(format);
                setAccuse(t.exporter.lance.replace("{n}", String(trouves.length)));
              }}
            />
          </RoleGate>
        }
      />

      <FilterBar
        recherche={recherche}
        onRecherche={(e) => {
          setRecherche(e.target.value);
          setPage(0);
        }}
        placeholder={t.comptes.recherche}
        filtres={[
          {
            cle: "etat",
            label: t.comptes.filtreEtat,
            valeur: filtreEtat,
            onChange: (e) => {
              setFiltreEtat(e.target.value as FiltreEtat);
              setPage(0);
            },
            options: [
              { value: "tous", label: t.comptes.tousEtats },
              { value: "actif", label: t.etats.actif },
              { value: "suspendu", label: t.etats.suspendu },
              { value: "suppression_en_cours", label: t.etats.grace },
              { value: "efface", label: t.etats.efface },
            ],
          },
          {
            cle: "solde",
            label: t.comptes.filtreCredits,
            valeur: filtreSolde,
            onChange: (e) => {
              setFiltreSolde(e.target.value as FiltreSolde);
              setPage(0);
            },
            options: [
              { value: "tous", label: t.comptes.tousCredits },
              { value: "zero", label: t.comptes.sansCredit },
              { value: "positif", label: t.comptes.avecCredit },
            ],
          },
        ]}
        resultats={resultats}
        {...(filtre ? { onReinitialiser: remiseAZero, reinitialiser: t.table.reinitialiser } : {})}
      />

      <DataTable
        colonnes={colonnes}
        lignes={lignes}
        tri={tri}
        onTri={(cle) =>
          setTri((courant) => ({ cle, sens: courant.cle === cle && courant.sens === "asc" ? "desc" : "asc" }))
        }
        actions={actions}
        onAction={surAction}
        onOuvrir={(ligne) => onOuvrir?.(ligne)}
        nom={(ligne) => ligne.pseudo}
        libelles={{
          toutSelectionner: t.table.toutSelectionner,
          selectionner: t.table.selectionner,
          actions: t.table.actions,
        }}
        vide={<EmptyState titre={t.comptes.vide.titre} texte={t.comptes.vide.texte} />}
      />

      {/* Parcours au curseur : deux sens, aucun total. Ici le curseur est le
          rang de la page suivante — demain, celui que rend l'API. */}
      {trouves.length > 0 ? (
        <Pagination
          curseurSuivant={courante < dernierePage ? String(courante + 1) : null}
          aPrecedent={courante > 0}
          onPrecedent={() => setPage(courante - 1)}
          onSuivant={() => setPage(courante + 1)}
          parPage={parPage}
          onParPage={(taille) => {
            setParPage(taille);
            setPage(0);
          }}
          tailles={TAILLES}
          libelles={{
            precedent: t.table.precedent,
            suivant: t.table.suivant,
            parPage: t.table.parPage,
            pagination: t.table.pagination,
          }}
        />
      ) : null}

      {geste && dialogue ? (
        <ConfirmWithReason
          destructif={geste.id === "suspendre"}
          titre={dialogue.titre.replace("{pseudo}", geste.compte.pseudo)}
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

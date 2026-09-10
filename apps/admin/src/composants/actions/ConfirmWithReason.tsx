import { useEffect, useId, useState, type ReactNode } from "react";
import { motifSchema } from "@lehno/contracts";
import { Button } from "../base/Button.js";

export interface LibellesConfirmation {
  /** Étiquette du sélecteur de motif. */
  motif?: string;
  /** Option vide en tête de liste. */
  choisir?: string;
  /** « Autre — préciser », ajoutée d'office à la liste. */
  autre?: string;
  /** Nom accessible du champ libre. */
  precision?: string;
  /** Rappel que le motif part au journal d'audit, sous le nom de qui agit. */
  journal?: string;
  annuler?: string;
  confirmer?: string;
}

export interface ConfirmWithReasonProps {
  titre: string;
  /** Ce que l'action entraîne, dit sans détour. */
  consequence?: string;
  destructif?: boolean;
  /* Motifs proposés. « Autre — préciser » est ajouté d'office.
   *
   * DEUX FORMES, et la seconde est celle qui compte. Un simple libellé ne peut
   * pas être compté : les libellés sont bilingues, et le même geste s'inscrivait
   * « Fraude suspectée » ou « Suspected fraud » selon la langue au moment du
   * clic. La forme `{ code, libelle }` porte le code stable du registre — c'est
   * lui qui part au serveur, qui l'exige sur tout geste ayant des motifs.
   *
   * La forme en chaînes reste acceptée pour les gestes que le registre ne
   * couvre pas encore : le serveur ne leur demande alors aucun code. */
  motifs?: readonly string[] | readonly { code: string; libelle: string }[];
  libelles?: LibellesConfirmation;
  /** Le motif écrit, et le CODE du registre quand il en vient un. */
  onConfirmer: (motif: string, code?: string) => void;
  onAnnuler: () => void;
  /* Ce qu'on règle, au-dessus du motif.
   *
   * Un réglage sensible et sa justification ne se séparent pas : les poser sur
   * deux écrans ferait enregistrer d'abord et justifier ensuite — donc parfois
   * pas du tout. Le dialogue reste clos tant que le motif ne dit rien, et ce
   * qu'on a saisi ne part pas sans lui.
   *
   * Absent, le dialogue reste ce qu'il était : une confirmation. */
  children?: ReactNode;
  /** Ce qui empêche d'enregistrer, quand le formulaire lui-même n'est pas
   *  formé. Le motif suffisant ne suffit pas si la saisie ne tient pas. */
  incomplet?: boolean;
}

// Valeur sentinelle du champ libre : ce n'est pas un motif, c'est le choix d'en
// écrire un. Elle ne s'affiche jamais — le libellé vient du dictionnaire.
const AUTRE = "autre";

/** Confirmation d'une action sensible.
 *
 *  **Le motif est obligatoire**, et il n'est pas une formalité : toute action
 *  journalisée l'est avec son auteur et sa raison (§4, §7). Le plancher n'est pas
 *  « non vide » mais celui du contrat serveur — `motifSchema` exige six
 *  caractères après élagage. Un motif de deux lettres satisferait la lettre de la
 *  règle et la viderait ; la confirmation reste donc close tant qu'il ne dit rien. */
export function ConfirmWithReason({
  titre,
  consequence,
  destructif = false,
  motifs = [],
  libelles = {},
  onConfirmer,
  onAnnuler,
  children,
  incomplet = false,
}: ConfirmWithReasonProps) {
  const [choix, setChoix] = useState("");
  const [libre, setLibre] = useState("");
  const idTitre = useId();
  const idMotif = useId();

  // Une sortie au clavier, toujours : un dialogue qui ne se referme qu'au clic
  // enferme celui qui s'est trompé de ligne.
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAnnuler();
    };
    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, [onAnnuler]);

  // Le même contrôle que le serveur, au même endroit du contrat : ce que
  // l'écran laisse passer est exactement ce que l'API accepte.
  /* La liste, ramenée à une seule forme. `valeur` est ce que le sélecteur
     porte : le code quand il y en a un, le libellé sinon — c'est ce qui permet
     de retrouver le code au moment de confirmer. */
  const liste = motifs.map((m) => (typeof m === "string"
    ? { valeur: m, libelle: m, code: undefined as string | undefined }
    : { valeur: m.code, libelle: m.libelle, code: m.code }));

  /* Ce qui est ÉCRIT au journal reste le libellé : un code seul rendrait la
     ligne illisible à qui la relit six mois plus tard. Le code l'accompagne,
     il ne le remplace pas. */
  const retenu = liste.find((m) => m.valeur === choix);
  const propose = choix === AUTRE ? libre : (retenu?.libelle ?? choix);
  const verdict = motifSchema.safeParse(propose);
  const suffisant = verdict.success;

  return (
    <div className="admin-dialogue-couche" role="dialog" aria-modal="true" aria-labelledby={idTitre}>
      <div className="admin-dialogue-voile" aria-hidden="true" />
      <div className="admin-dialogue">
        <h2 className="admin-dialogue-titre" id={idTitre}>{titre}</h2>
        {consequence ? <p className="admin-dialogue-consequence">{consequence}</p> : null}

        {children ? <div className="admin-dialogue-corps">{children}</div> : null}

        <div className="admin-dialogue-motif">
          <label className="admin-dialogue-etiquette" data-requis="true" htmlFor={idMotif}>
            {libelles.motif}
          </label>
          <select
            id={idMotif}
            required
            className="admin-champ admin-focus admin-dialogue-choix"
            value={choix}
            onChange={(e) => setChoix(e.target.value)}
          >
            <option value="">{libelles.choisir}</option>
            {liste.map((motif) => (
              <option key={motif.valeur} value={motif.valeur}>{motif.libelle}</option>
            ))}
            <option value={AUTRE}>{libelles.autre}</option>
          </select>

          {choix === AUTRE ? (
            <textarea
              className="admin-dialogue-libre admin-focus"
              rows={3}
              value={libre}
              aria-label={libelles.precision}
              placeholder={libelles.precision}
              onChange={(e) => setLibre(e.target.value)}
            />
          ) : null}

          {libelles.journal ? <p className="admin-dialogue-note">{libelles.journal}</p> : null}
        </div>

        <div className="admin-dialogue-actions">
          <Button variant="text" onClick={onAnnuler}>{libelles.annuler}</Button>
          <Button
            variant={destructif ? "destructive" : "primary"}
            disabled={!suffisant || incomplet}
            onClick={verdict.success ? () => onConfirmer(verdict.data, retenu?.code) : undefined}
          >
            {libelles.confirmer}
          </Button>
        </div>
      </div>
    </div>
  );
}

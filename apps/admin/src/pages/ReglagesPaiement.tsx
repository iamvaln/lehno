import { useId, useState, type ReactNode } from "react";

import { FormRow } from "../composants/page/index.js";
import { TextField } from "../composants/base/index.js";

/* LES FORMULAIRES DES RÉGLAGES DE PAIEMENT.
 *
 * Ils vivent à part de `Credits.tsx`, qui affiche déjà trois tableaux, deux
 * onglets et une décision : y ajouter trois formulaires en aurait fait un
 * fichier que personne ne relit.
 *
 * UN DESCRIPTEUR, PAS TROIS MARKUPS. Les trois réglages n'ont en commun ni
 * leurs champs ni leurs bornes, mais ils ont la même forme : des lignes
 * étiquetées, la valeur précédente rappelée à côté, et un enregistrement qui ne
 * part qu'avec un motif. Recopier le markup trois fois ferait dériver l'un des
 * trois au premier ajustement.
 *
 * LA VALEUR PRÉCÉDENTE EST RAPPELÉE, toujours. « C'est ce qui distingue un
 * paramètre qui pilote le produit d'un champ ordinaire : on voit ce qu'on
 * change avant d'enregistrer. » Sur un prix, la distinction n'est pas
 * théorique.
 */

export type Champ =
  | { cle: string; libelle: string; genre: "texte"; valeur: string; aide?: string; requis?: boolean }
  | { cle: string; libelle: string; genre: "nombre"; valeur: number | null; aide?: string; requis?: boolean }
  | { cle: string; libelle: string; genre: "booleen"; valeur: boolean; aide?: string }
  | { cle: string; libelle: string; genre: "choix"; valeur: string; options: { valeur: string; libelle: string }[]; aide?: string };

/** Ce que le formulaire rend : la seule saisie, sans le motif — celui-ci
 *  appartient au dialogue qui l'entoure, et part avec. */
export type Saisie = Record<string, string | number | boolean | null>;

export interface FormulaireReglageProps {
  champs: Champ[];
  valeurs: Saisie;
  onChanger: (cle: string, valeur: string | number | boolean | null) => void;
  /** « Valeur précédente », dans la langue de lecture. */
  libellePrecedente: string;
}

/** Ce qu'un champ vaut à l'écran, pour le rappel de la valeur précédente. */
function lisible(champ: Champ, oui: string, non: string): ReactNode {
  if (champ.genre === "booleen") return champ.valeur ? oui : non;
  if (champ.genre === "choix") {
    return champ.options.find((o) => o.valeur === champ.valeur)?.libelle ?? champ.valeur;
  }
  /* Un nombre nul n'est pas zéro : « pas de plancher de frais » et « plancher à
     zéro » se règlent différemment, et les confondre ferait payer. */
  return champ.valeur === null || champ.valeur === "" ? "—" : String(champ.valeur);
}

export function FormulaireReglage({
  champs, valeurs, onChanger, libellePrecedente, oui, non,
}: FormulaireReglageProps & { oui: string; non: string }) {
  const prefixe = useId();

  return (
    <>
      {champs.map((champ) => {
        const id = `${prefixe}-${champ.cle}`;
        const courant = valeurs[champ.cle];
        return (
          <FormRow
            key={champ.cle}
            label={champ.libelle}
            champId={id}
            libellePrecedente={libellePrecedente}
            precedente={lisible(champ, oui, non)}
            {...(champ.aide ? { aide: champ.aide } : {})}
          >
            {champ.genre === "booleen" ? (
              /* Une case, pas un interrupteur : elle vit dans un formulaire
                 qu'on enregistre, et l'interrupteur promettrait un effet
                 immédiat que le motif obligatoire interdit. */
              <input
                id={id}
                type="checkbox"
                className="admin-case admin-focus"
                checked={courant === true}
                onChange={(e) => onChanger(champ.cle, e.target.checked)}
              />
            ) : champ.genre === "choix" ? (
              <select
                id={id}
                className="admin-champ admin-focus"
                value={String(courant ?? "")}
                onChange={(e) => onChanger(champ.cle, e.target.value)}
              >
                {champ.options.map((o) => (
                  <option key={o.valeur} value={o.valeur}>{o.libelle}</option>
                ))}
              </select>
            ) : (
              <TextField
                id={id}
                type={champ.genre === "nombre" ? "number" : "text"}
                value={courant === null || courant === undefined ? "" : String(courant)}
                onChange={(e) => onChanger(
                  champ.cle,
                  /* Vide = ABSENT, pas zéro. Sur `fraisMin`, zéro dit « un
                     plancher, à zéro » et l'absence dit « pas de plancher » :
                     l'API distingue les deux, l'écran ne doit pas les fondre. */
                  champ.genre === "nombre"
                    ? (e.target.value.trim() === "" ? null : Number(e.target.value))
                    : e.target.value,
                )}
              />
            )}
          </FormRow>
        );
      })}
    </>
  );
}

/** Ce qui part au serveur : les seules valeurs QUI ONT CHANGÉ.
 *
 *  Un PATCH qui renvoie tout réécrirait des champs qu'on n'a pas touchés — et
 *  sur un canal, réécrire un barème inchangé ouvre une version d'historique
 *  qui ne change rien, en la datant d'aujourd'hui. L'historique dirait alors
 *  qu'on a modifié les frais le jour où l'on a corrigé un libellé. */
export function cequiAChange(champs: Champ[], valeurs: Saisie): Saisie {
  const sortie: Saisie = {};
  for (const champ of champs) {
    const avant = champ.genre === "nombre" && champ.valeur === null ? null : champ.valeur;
    const apres = valeurs[champ.cle] ?? null;
    if (apres !== avant) sortie[champ.cle] = apres;
  }
  return sortie;
}

/** Les valeurs d'ouverture d'un formulaire : celles qu'on a, telles qu'elles sont. */
export function valeursInitiales(champs: Champ[]): Saisie {
  return Object.fromEntries(champs.map((c) => [c.cle, c.valeur]));
}

/** Ce qui manque pour enregistrer : un champ requis laissé vide. */
export function incomplet(champs: Champ[], valeurs: Saisie): boolean {
  return champs.some((c) => {
    if (!("requis" in c) || !c.requis) return false;
    const v = valeurs[c.cle];
    return v === null || v === undefined || String(v).trim() === "";
  });
}

/** L'état d'un formulaire ouvert, et de quoi le piloter. */
export function useFormulaire(champs: Champ[]) {
  const [valeurs, setValeurs] = useState<Saisie>(() => valeursInitiales(champs));
  return {
    valeurs,
    changer: (cle: string, v: string | number | boolean | null) =>
      setValeurs((etat) => ({ ...etat, [cle]: v })),
    modifie: () => cequiAChange(champs, valeurs),
    incomplet: incomplet(champs, valeurs),
  };
}

import { occurrenceSchema, type Occurrence } from "@lehno/contracts";
import { composeLaDemande, pistesOffertes, type Demande } from "./preparation.js";

/* Cadrage des idées de cadeau — §3.7, le pas qui précède la recherche.
 *
 * Même motif que la préparation et la génération : `react-native` est typé en
 * Flow, et aucun de nos outils de test ne sait le lire. Tout ce qui se décide
 * vit donc ici, où Vitest le charge, et l'écran ne fait que l'appliquer.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE LA MAQUETTE DEMANDE ET QUE LE CONTRAT NE PORTE PAS : LE BUDGET.
 *
 * `CadrageIdeesScreen.jsx` dessine DEUX champs — un budget libre avec ses
 * paliers, et une note. `startGenerationSchema` n'en porte qu'un :
 * `briefText`, que le serveur range en `texteLibre`. Il n'existe AUCUN champ
 * de budget au lancement d'une génération.
 *
 * Trois issues, et deux sont mauvaises :
 *
 * — dessiner le champ et ne rien en faire : la saisie s'évapore à l'envoi, et
 *   les idées reviennent hors budget sans que personne comprenne pourquoi.
 *   C'est le pire des trois, parce que ça se découvre sur le résultat payé ;
 * — le replier dans `briefText` : ce serait inventer une convention que le
 *   serveur n'a pas — « Budget : 15 000 F » ne veut rien dire pour lui —, et
 *   manger la borne de 280 caractères de la note pour un texte que personne
 *   ne lit comme un budget.
 * — ne pas le dessiner, et le dire. C'est ce qu'on fait.
 *
 * Le champ reviendra le jour où le contrat portera de quoi le transporter.
 * D'ici là, `cadrageBudget` et `cadrageBudgetAide` restent au dictionnaire,
 * inemployés — ce sont eux le rappel.
 * ───────────────────────────────────────────────────────────────────────── */

// ── L'ouverture de l'écran ──────────────────────────────────────────────────

export type OuvertureDuCadrage =
  | { sorte: "cadrer"; occurrenceId: string; chemin: string }
  | { sorte: "sans-objet" };

/* LES PARAMÈTRES DE ROUTE NE SONT PAS DE CONFIANCE : un lien profond les pose,
 * et `expo-router` les rend tels quels. Sans cette garde, `lehno://cadrage?
 * occurrenceId=../../admin` partirait dans un chemin d'API — et une chaîne
 * vide donnerait `/me/occurrences/`, c'est-à-dire la liste entière.
 *
 * La forme vient du CONTRAT — `occurrenceSchema.shape.id` — et pas d'une
 * expression régulière recopiée ici : deux définitions de la même chose
 * finissent par diverger, et c'est le serveur qui a raison.
 */
export function ouvertureDuCadrage(occurrenceId: string | undefined): OuvertureDuCadrage {
  const analyse = occurrenceSchema.shape.id.safeParse(occurrenceId);
  if (!analyse.success) return { sorte: "sans-objet" };
  return {
    sorte: "cadrer",
    occurrenceId: analyse.data,
    chemin: `/me/occurrences/${analyse.data}`,
  };
}

// ── Ce que la note vaut ─────────────────────────────────────────────────────

/* La borne du contrat — `briefText: z.string().trim().max(280)` —, redite ici
   pour que l'écran n'ait pas à charger un schéma zod juste pour éteindre un
   bouton. Le test l'ancre au schéma lui-même : s'il bouge, il tombe. */
export const LIMITE_DE_LA_NOTE = 280;

/* Ce que la note vaut vraiment : sans ses blancs. `startGenerationSchema`
   applique `.trim()` AVANT de mesurer, donc trois espaces sont une note vide —
   et une note de 280 caractères entourée d'espaces passe. */
export function noteUtile(saisie: string): string {
  return saisie.trim();
}

/* Le champ est FACULTATIF, et c'est tout le propos de l'écran : on peut
   chercher sans rien dire. Vide, la note tient donc — seule la longueur peut
   la faire échouer, et alors le bouton s'éteint plutôt que d'envoyer ce qu'on
   sait refusé. */
export function noteTient(saisie: string): boolean {
  return noteUtile(saisie).length <= LIMITE_DE_LA_NOTE;
}

// ── La demande ──────────────────────────────────────────────────────────────

export interface DemandeDIdees extends Demande {
  briefText?: string;
}

/* Ce qu'on envoie à `POST /me/generations`.
 *
 * La cible, la nature et la clé d'idempotence viennent de `composeLaDemande` —
 * les réécrire ici ferait deux clés pour la même demande, donc deux débits sur
 * deux appuis maladroits, ce que cette clé existe précisément pour empêcher.
 *
 * `briefText` s'AJOUTE ou n'existe pas. Ni `null` — le schéma le dit
 * `optional()`, pas nullable —, ni `undefined` posé explicitement, que
 * `exactOptionalPropertyTypes` interdit. L'absence de la clé EST la recherche
 * sans consigne.
 *
 * Rend `null` quand rien ne peut partir : identifiant douteux, ou note plus
 * longue que ce que le contrat accepte. L'appelant n'a alors rien à envoyer.
 */
export function demandeDIdees(
  occurrenceId: string | undefined,
  saisie: string,
): DemandeDIdees | null {
  const ouverture = ouvertureDuCadrage(occurrenceId);
  if (ouverture.sorte !== "cadrer") return null;
  if (!noteTient(saisie)) return null;
  const note = noteUtile(saisie);
  return {
    ...composeLaDemande("gift_ideas", ouverture.occurrenceId),
    ...(note.length === 0 ? {} : { briefText: note }),
  };
}

// ── Qui a droit à cet écran ─────────────────────────────────────────────────

/* UNE OCCASION SENSIBLE N'A PAS D'IDÉES DE CADEAU, et l'écran de cadrage n'est
 * pas une porte dérobée vers celles-ci : on l'atteint par lien profond comme
 * n'importe quelle route.
 *
 * La règle n'est pas réécrite ici — `pistesOffertes` la porte déjà, drapeau
 * compris. Une seconde version finirait par diverger de la première, et c'est
 * l'écran de préparation qui aurait raison sur celui-ci, ou l'inverse.
 */
export function ideesOffertes(
  occasion: Pick<Occurrence, "nature">,
  actives: readonly string[],
): boolean {
  return pistesOffertes(occasion, actives).some((p) => p.kind === "gift_ideas");
}

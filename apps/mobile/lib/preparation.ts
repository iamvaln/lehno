import { estActive, type GenerationKind, type Occurrence } from "@lehno/contracts";

/* Préparer une occasion — §3.7.
 *
 * Deux pistes, et elles ne se valent pas : le MESSAGE et les IDÉES DE CADEAU.
 * Chacune suit son propre drapeau, et §3.7 s'ouvre dès qu'une des deux tient —
 * les trois natures de génération sont trois drapeaux, pas un interrupteur.
 * Au lancement, seul le message est allumé : c'est le cas NOMINAL, pas une
 * variante.
 */

export interface Piste {
  kind: GenerationKind;
  drapeau: string;
}

const PISTES: readonly Piste[] = [
  { kind: "wish_message", drapeau: "generation.message" },
  { kind: "gift_ideas", drapeau: "generation.ideas" },
];

/* UNE OCCASION SENSIBLE N'A PAS D'IDÉES DE CADEAU.
 *
 * La tonalité d'un événement commande le ton de ce qui sera écrit, et fait
 * disparaître les idées de cadeau — le contrat le dit sur `EVENT_NATURES`. On
 * ne propose pas d'offrir quelque chose pour un deuil ou une épreuve, et
 * laisser le bouton grisé serait pire : il dirait qu'on y avait pensé.
 *
 * Le message, lui, demeure. C'est même le seul moment où il compte vraiment.
 */
export function pistesOffertes(
  occasion: Pick<Occurrence, "nature">,
  actives: readonly string[],
): Piste[] {
  return PISTES.filter(({ kind, drapeau }) => {
    if (!estActive(actives, drapeau)) return false;
    return !(occasion.nature === "sensitive" && kind === "gift_ideas");
  });
}

/* LA CLÉ D'IDEMPOTENCE — ce qui empêche de payer deux fois.
 *
 * « Une même demande relancée rejoint la génération en cours plutôt que d'en
 * créer une seconde, et ne débite qu'une fois. » Encore faut-il que la demande
 * soit RECONNAISSABLE : une clé tirée au hasard à chaque appui ferait de deux
 * touches maladroites deux générations, et deux débits.
 *
 * Elle se compose donc de ce qui identifie la demande — sa nature et ce
 * qu'elle vise —, et de rien d'autre. Pas d'horodatage : il rendrait deux
 * appuis distincts, ce qui est précisément le cas qu'on veut fondre.
 */
export function cleDeDemande(kind: GenerationKind, cible: string): string {
  return `${kind}:${cible}`;
}

export interface Demande {
  kind: GenerationKind;
  occurrenceId?: string;
  personId?: string;
  idempotencyKey: string;
}

/* Ce qu'on envoie. La cible dépend de la nature, et le contrat refuse les deux
   ensemble : un portrait vise un PROCHE — il se génère à tout moment depuis sa
   fiche —, les idées et le message visent une OCCASION, parce que c'est l'année
   concernée qui les ancre. */
export function composeLaDemande(kind: GenerationKind, cible: string): Demande {
  const base = { kind, idempotencyKey: cleDeDemande(kind, cible) };
  return kind === "portrait"
    ? { ...base, personId: cible }
    : { ...base, occurrenceId: cible };
}

/* CE QUI EXISTE DÉJÀ NE SE REDEMANDE PAS.
 *
 * Une occasion qui porte déjà un message produit n'offre plus « Préparer »
 * mais « Voir » — et une relance reste possible, explicitement. Reproposer le
 * geste initial ferait repayer sans le dire, et le crédit est débité à la
 * DEMANDE, pas à l'affichage.
 */
export type EtatDePiste = "a_faire" | "a_voir";

export function etatDeLaPiste(dejaProduite: boolean): EtatDePiste {
  return dejaProduite ? "a_voir" : "a_faire";
}

/* CE QUE L'ACTION COÛTE — lu en base, jamais écrit ici.
 *
 * Le prix se règle en administration sans livraison. Une constante côté client
 * afficherait l'ancien tarif sur tout un parc jusqu'à la mise à jour suivante,
 * et « rien ne se paie en silence » veut dire que le coût annoncé est le coût
 * débité — sinon la phrase ne vaut rien.
 *
 * UNE ACTION ABSENTE N'EST PAS DISPONIBLE. Même convention que les drapeaux :
 * ce qui n'est pas là est éteint, et « absent » se confond avec « inconnu » à
 * dessein — une version antérieure ignore un code qu'elle ne connaît pas au
 * lieu de refuser la réponse entière.
 *
 * `null` plutôt que zéro : un zéro voudrait dire GRATUIT — un prix que la
 * table porte, pas une absence de prix. Les confondre ferait lancer une action
 * qu'on ne sait pas facturer, en la disant offerte.
 */
export function coutDe(
  actions: readonly { code: string; credits: number }[],
  kind: GenerationKind,
): number | null {
  return actions.find((a) => a.code === kind)?.credits ?? null;
}

/* LA FEUILLE S'OUVRE TOUJOURS, et c'est pour ça qu'il n'y a pas de fonction
   ici pour en décider.
   
   Il a existé un `passeParLaFeuille(actives)` gouverné par un drapeau
   `credits`, écrit pour un « achat éteint » qui rendrait les générations
   gratuites. CE DRAPEAU N'EXISTE PAS, et le contrat l'interdit nommément :
   l'éteindre « laissait des soldes indépensables ». La fonction rendait donc
   `false` en permanence, et la génération partait au premier appui — un crédit
   débité sans que rien ne soit annoncé, l'inverse exact de ce qu'elle croyait
   garantir.
   
   Rien ne se paie en silence : il n'y a pas d'exception à ménager. */

import { z } from "zod";
import { occurrenceSchema } from "./me-events.js";

/* L'accueil en un appel — spec technique §5.8, spec mobile 3.2.
 *
 * L'accueil tient en deux éléments : une phrase qui donne l'état des lieux, et
 * les trois échéances les plus proches. Les échéances viennent de
 * `/me/occurrences`, mais la phrase demande des décomptes que cette liste
 * plafonnée ne donne pas — trois échéances rendues ne disent pas combien il y
 * en a cette semaine. Les rendre ensemble évite un aller-retour au démarrage et
 * laisse le serveur composer la phrase à partir de ses propres chiffres.
 */

export const homeCountsSchema = z.object({
  today: z.number().int().min(0),
  thisWeek: z.number().int().min(0),
}).strict();

/** Ce que l'accueil rend d'un coup : au plus **sept** échéances. */
export const ECHEANCES_ACCUEIL = 7;

export const homeSchema = z.object({
  firstName: z.string(),
  /**
   * Au plus **sept** — trois cartes puis quatre rangs (§3.2). Ce n'est pas
   * réglable : l'écran a une forme, et un paramètre inviterait deux clients à
   * en demander deux quantités différentes.
   */
  occurrences: z.array(occurrenceSchema),
  counts: homeCountsSchema,
  // Le décompte de la cloche accompagne la réponse parce que l'en-tête
  // l'affiche dès l'ouverture : le demander à part ferait clignoter la pastille.
  unreadNotifications: z.number().int().min(0),
  /* Les deux états vides de la spec 3.2 ne se ressemblent pas. Au premier
     lancement, le bouton principal devient « Ajouter un anniversaire » — « il
     n'y a personne à propos de qui écrire ». Quand le carnet est rempli mais
     que rien n'approche, « Laisser une note » demeure. Le client ne peut pas
     deviner lequel des deux depuis une liste vide : ce drapeau lui évite
     d'appeler /me/persons rien que pour choisir un libellé de bouton. */
  hasPersons: z.boolean(),
  /**
   * Combien d'échéances viennent **au-delà** de celles rendues, dans les douze
   * prochains mois. C'est le nombre de « Voir plus · n restants ».
   *
   * **Le client ne peut pas le calculer** : la liste est plafonnée à sept, et
   * `counts` porte aujourd'hui et la semaine — ni l'un ni l'autre ne dit
   * combien il en reste ensuite.
   *
   * **Douze mois, et c'est délibéré.** Sans borne, le nombre compterait toutes
   * les échéances déroulées d'avance — l'ordonnanceur en ouvre trois par
   * événement. Il dirait alors la profondeur de déroulement, un détail interne,
   * au lieu de ce qu'une personne reconnaît de son année. À douze mois, chaque
   * date annuelle paraît une fois : « quatorze autres dates cette année ».
   *
   * **Zéro veut dire qu'il n'y a rien de plus** — le bouton ne s'affiche pas.
   */
  remainingOccurrences: z.number().int().min(0),
}).strict();

export type Home = z.infer<typeof homeSchema>;
export type HomeCounts = z.infer<typeof homeCountsSchema>;

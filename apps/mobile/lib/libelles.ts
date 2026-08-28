import type {
  CategoryCode, ContactChannel, EventKind, PersonGender, PersonRegister,
  PersonRelation,
} from "@lehno/contracts";
import type { Messages } from "../messages/index.js";

/* Les clés dont la valeur est une CHAÎNE. Le dictionnaire porte aussi des
   fonctions — « 3 notes », « J−3 » —, et `keyof Messages` ferait rendre leur
   union à `t[cle]`. Ces tables ne désignent que des libellés fixes. */
type CleDeTexte = {
  [K in keyof Messages]: Messages[K] extends string ? K : never;
}[keyof Messages];

/* Les valeurs du contrat, et le libellé qui les dit.
 *
 * Des TABLES TYPÉES plutôt qu'un `switch` ou une concaténation de clés :
 * `Record<PersonRelation, …>` refuse de compiler tant qu'une valeur ajoutée au
 * contrat n'a pas son libellé. Une clé construite à la volée —
 * `t["rel" + valeur]` — laisserait au contraire passer le manque jusqu'à
 * l'écran, où il s'afficherait en « undefined ».
 */

const RELATIONS: Record<PersonRelation, CleDeTexte> = {
  famille_proche: "relFamilleProche",
  famille_etendue: "relFamilleEtendue",
  ami: "relAmi",
  partenaire: "relPartenaire",
  collegue: "relCollegue",
  relation_pro: "relPro",
  connaissance: "relConnaissance",
};

const REGISTRES: Record<PersonRegister, CleDeTexte> = {
  familier: "registreFamilier",
  amical: "registreAmical",
  formel: "registreFormel",
};

const CANAUX: Record<ContactChannel, CleDeTexte> = {
  whatsapp: "canalWhatsapp",
  sms: "canalSms",
  email: "canalEmail",
  autre: "canalAutre",
};

/* Les sept catégories de notes. Elles ne sont PAS deux : la fiche affichait
   « idée » ou « à éviter » pour tout, et une note rangée en « Faits marquants »
   — « Danielle a une allergie aux fruits à coque » — s'annonçait comme une
   idée. Le serveur sert les sept, chacune avec sa nature ; l'écran les dit
   toutes.

   `interests` et `dislikes_nogo` reprennent des libellés que le kit portait
   déjà : ce sont les mots de l'écran, là où la doc dit « Intérêts / goûts » et
   « Dislikes / no-go ». */
const CATEGORIES: Record<CategoryCode, CleDeTexte> = {
  gift_ideas: "catIdeesCadeaux",
  message_ideas: "catIdeesMessages",
  facts: "catFaits",
  encouragements: "catEncouragements",
  challenges: "catChallenges",
  interests: "ficheInterets",
  dislikes_nogo: "noteEviter",
};

/* Le genre, à DEUX valeurs — parce que c'est un ACCORD, pas une identité.
   « En français on n'écrit pas à quelqu'un sans le savoir » : le contrat le
   rend obligatoire à la création pour cette seule raison, et aucune phrase de
   l'interface ne s'en sert. Seule la génération le reçoit. */
const GENRES: Record<PersonGender, CleDeTexte> = {
  female: "genreFeminin",
  male: "genreMasculin",
};

export const CLES_DE_GENRE = GENRES;
export const CLES_DE_CATEGORIE = CATEGORIES;
export const CLES_DE_RELATION = RELATIONS;
export const CLES_DE_REGISTRE = REGISTRES;
export const CLES_DE_CANAL = CANAUX;

/* Le libellé d'une échéance. Un anniversaire prend le sien dans les
   traductions ; tout autre événement affiche le SIEN, tel quel, sans
   traduction — c'est du contenu saisi par l'utilisateur, pas une clé.
   Le traduire reviendrait à réécrire ce qu'il a écrit. */
export function libelleDeLEcheance(
  kind: EventKind,
  label: string | null,
  t: Messages,
): string {
  if (kind === "birthday") return t.typeAnniversaire;
  return label ?? t.typeAutre;
}

// Le classement d'une note en catégories, par indices lexicaux.
//
// Aucun appel de modèle. Le classement se fait à l'écriture, sans dépendance ni
// attente, et sert la LISIBILITÉ de la fiche — pas la génération : celle-ci lit
// le contenu des notes, qu'elles soient rangées ou non. Une étiquette manquante
// ou approximative ne retire donc rien à ce que le produit sait dire du proche.
//
// Une passe d'IA pourra plus tard réviser les rattachements en arrière-plan
// (voir le plan de phase 1, tâche 4). Cette fonction est pure, sans état ni
// réseau : elle se remplace sans toucher au reste.
export const CODES = [
  "gift_ideas", "message_ideas", "facts", "encouragements", "challenges",
  "interests", "dislikes_nogo",
] as const;

export type CategoryCode = (typeof CODES)[number];

// Les accents ne changent pas le sens : « cinéma » et « cinema » se rangent
// pareil. La normalisation NFD sépare la lettre de son accent, qu'on retire.
// L'apostrophe typographique devient droite, sinon « n’aime » et « n'aime »
// seraient deux chaînes différentes pour la même phrase.
function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// « dislikes_nogo » n'est pas une étiquette comme les autres. La doc
// fonctionnelle §8 en fait une CONTRAINTE ACTIVE : elle écarte les idées de
// cadeau et les formulations incompatibles — « ne pas proposer de vin à une
// personne qui ne boit pas ». Se tromper ici change ce que le produit PROPOSE,
// là où confondre « faits » et « intérêts » ne coûte qu'un rangement
// approximatif. D'où une liste tenue à part, et plus attentive.
const REFUS: readonly string[] = [
  "n'aime pas", "aime pas", "ne bois pas", "ne mange pas", "ne boit pas",
  "ne mange plus", "ne supporte pas", "supporte pas", "ne veut pas",
  "veut pas de", "deteste", "allergique", "ne peut pas", "evite",
  "jamais de", "pas question", "hors de question",
];

const INDICES: { code: CategoryCode; mots: readonly string[] }[] = [
  { code: "challenges", mots: ["difficile", "difficulte", "epreuve", "traverse", "malade", "deuil", "chomage", "fatigue", "separation"] },
  { code: "encouragements", mots: ["soutenir", "soutien", "encourager", "besoin qu on", "besoin de", "rassurer", "fier de"] },
  { code: "gift_ideas", mots: ["cadeau", "offrir", "aimerait avoir", "revait de", "reve de", "voudrait", "envie de"] },
  { code: "message_ideas", mots: ["lui dire", "lui ecrire", "message", "mot pour", "remercier"] },
  { code: "interests", mots: ["adore", "aime", "passionne", "fan de", "cinema", "musique", "lecture", "sport", "cuisine", "voyage"] },
];

export function classer(texte: string): CategoryCode[] {
  const t = normaliser(texte);
  const refuse = REFUS.some((m) => t.includes(m));

  const trouves = INDICES
    .filter(({ mots }) => mots.some((m) => t.includes(m)))
    .map(({ code }) => code)
    // Le refus l'emporte sur le goût, et il faut l'ÉCRIRE : « n'aime pas »
    // contient « aime », donc sans cette exclusion la phrase tomberait aussi
    // dans les intérêts et le produit proposerait précisément ce que la
    // personne rejette. Ordonner la liste ci-dessus n'y suffisait pas — un
    // filtre rend toutes les correspondances, pas la première.
    .filter((code) => !(refuse && code === "interests"));

  if (refuse) trouves.unshift("dislikes_nogo");

  // Aucun indice : aucune catégorie. Le classement décore la fiche, il ne
  // conditionne pas ce que la génération sait lire.
  return [...new Set(trouves)];
}

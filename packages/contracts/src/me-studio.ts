import { z } from "zod";

/* Le studio du portrait — un catalogue servi, pas un ensemble figé.
 *
 * Ce que l'application propose au studio n'est pas arrêté : orientations,
 * voies d'image, familles, styles, ambiances, formats sont des explorations qui
 * bougeront. Les geler dans un enum du client obligerait à livrer une version
 * de l'application pour ajouter une ambiance — et un parc ne se met pas à jour
 * d'un bloc. Le serveur rend donc le catalogue, l'utilisateur choisit dedans, et
 * la sélection remonte telle quelle.
 *
 * L'application ne compose rien. Elle affiche l'image que l'API produit : le
 * portrait est une image, pas une page, et son assemblage appartient au serveur.
 *
 * Les libellés arrivent déjà résolus dans la langue demandée — comme les
 * documents légaux. Les faire dépendre du dictionnaire embarqué rendrait toute
 * nouvelle option muette sur les applications déjà installées, ce qui reviendrait
 * à ne pas servir le catalogue du tout.
 */

export const studioChoiceSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1),
  description: z.string().nullable(),
  // Un avertissement s'affiche au moment du choix, pas après la génération —
  // l'hommage change le gabarit, et l'apprendre trop tard fait perdre un crédit.
  warning: z.string().nullable(),
  // Le groupe que ce choix fait apparaître. C'est ici, et nulle part dans le
  // code du client, que vit « une illustration porte sa famille ».
  revealsGroup: z.string().min(1).nullable(),
}).strict();

export const studioGroupSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1),
  defaultChoiceId: z.string().min(1),
  choices: z.array(studioChoiceSchema).min(1),
}).strict();

export const studioConfigSchema = z.object({
  groups: z.array(studioGroupSchema).min(1),
  // Les groupes montrés d'emblée ; les autres n'apparaissent que révélés.
  rootGroupIds: z.array(z.string().min(1)).min(1),
}).strict().superRefine((config, ctx) => {
  const parId = new Map(config.groups.map((g) => [g.id, g]));

  if (parId.size !== config.groups.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["groups"], message: "deux groupes portent le même identifiant" });
  }

  for (const groupe of config.groups) {
    const choix = new Set(groupe.choices.map((c) => c.id));
    if (choix.size !== groupe.choices.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["groups", groupe.id], message: "deux choix portent le même identifiant" });
    }
    // Un défaut qui ne désigne rien laisse l'écran sans sélection initiale.
    if (!choix.has(groupe.defaultChoiceId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["groups", groupe.id, "defaultChoiceId"], message: "le défaut ne désigne aucun choix de ce groupe" });
    }
    // Un choix qui révèle un groupe absent rend un écran sans suite : on
    // choisit « une photo » et rien n'apparaît.
    for (const c of groupe.choices) {
      if (c.revealsGroup && !parId.has(c.revealsGroup)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["groups", groupe.id, c.id], message: `le groupe révélé « ${c.revealsGroup} » n'existe pas` });
      }
    }
  }

  for (const racine of config.rootGroupIds) {
    if (!parId.has(racine)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rootGroupIds"], message: `le groupe « ${racine} » n'existe pas` });
    }
  }
});

export type StudioChoice = z.infer<typeof studioChoiceSchema>;
export type StudioGroup = z.infer<typeof studioGroupSchema>;
export type StudioConfig = z.infer<typeof studioConfigSchema>;

/* Une sélection : un choix par groupe, désigné par son identifiant. */
export type StudioSelection = Record<string, string>;

/* Les groupes que la sélection courante rend visibles, dans l'ordre où l'écran
   les pose : les racines, puis ce que chaque choix ouvre. C'est cette fonction
   qui remplace les règles jadis écrites en dur — l'écran affiche ce qu'elle
   rend, sans savoir ce qu'est une famille d'illustration. */
export function groupesAtteignables(config: StudioConfig, selection: StudioSelection): string[] {
  const parId = new Map(config.groups.map((g) => [g.id, g]));
  const vus = new Set<string>();
  const ordre: string[] = [];
  const aVoir = [...config.rootGroupIds];

  while (aVoir.length > 0) {
    const id = aVoir.shift()!;
    if (vus.has(id) || !parId.has(id)) continue;
    vus.add(id);
    ordre.push(id);

    const choisi = selection[id] ?? parId.get(id)!.defaultChoiceId;
    const choix = parId.get(id)!.choices.find((c) => c.id === choisi);
    if (choix?.revealsGroup) aVoir.push(choix.revealsGroup);
  }
  return ordre;
}

export const RAISONS = ["manquant", "hors-portee", "choix-inconnu"] as const;
export type RaisonDeRefus = (typeof RAISONS)[number];

export interface DefautDeSelection {
  groupId: string;
  raison: RaisonDeRefus;
}

/* Ce que le serveur revérifiera de toute façon — il décide seul — mais que le
   client tient à la saisie pour ne pas dépenser un crédit sur une demande
   incohérente. Trois défauts, et le troisième compte autant que les autres :
   répondre à un groupe que rien n'a ouvert produirait une image que la
   description ne couvre pas. */
export function valideSelection(config: StudioConfig, selection: StudioSelection): DefautDeSelection[] {
  const parId = new Map(config.groups.map((g) => [g.id, g]));
  const ouverts = new Set(groupesAtteignables(config, selection));
  const defauts: DefautDeSelection[] = [];

  for (const groupId of groupesAtteignables(config, selection)) {
    const choisi = selection[groupId];
    if (choisi === undefined) {
      defauts.push({ groupId, raison: "manquant" });
    } else if (!parId.get(groupId)!.choices.some((c) => c.id === choisi)) {
      defauts.push({ groupId, raison: "choix-inconnu" });
    }
  }

  for (const groupId of Object.keys(selection)) {
    if (!ouverts.has(groupId)) defauts.push({ groupId, raison: "hors-portee" });
  }

  return defauts;
}

/* Ce que rend `/me/studio/options` — spec technique §5.4.
 *
 * Trois choses, et pas une de plus : le catalogue tel que la configuration EN
 * SERVICE l'expose, ce que l'action coûte, et le numéro de la version qui l'a
 * produit.
 *
 * **Le prix vient de la base** (`PremiumAction.credit_cost`), jamais d'une
 * constante : il se règle en administration sans livraison, et un prix recopié
 * dans le client afficherait l'ancien tarif sur tout un parc jusqu'à la mise à
 * jour suivante. C'est la même raison qui met le catalogue au serveur.
 *
 * `version` sert l'assistance, pas l'écran : quand quelqu'un rapporte un
 * portrait raté, elle dit quelle configuration il avait sous les yeux. Nulle
 * seulement si rien n'a jamais été publié — un état que la réconciliation au
 * démarrage rend improbable, mais qu'on ne peut pas jurer impossible.
 */
export const studioOptionsSchema = z.object({
  catalogue: studioConfigSchema,
  creditCost: z.number().int().min(0),
  /* DEUX numéros, un par nature.
   *
   * Le catalogue réunit deux configurations — les orientations viennent du
   * message, les voies et les ambiances du portrait. Un seul numéro en
   * désignerait donc la mauvaise une fois sur deux, et l'assistance chercherait
   * le réglage d'un texte pour expliquer une image ratée.
   *
   * Nuls tant que rien n'a été publié de cette nature-là. */
  version: z.object({
    message: z.number().int().positive().nullable(),
    portrait: z.number().int().positive().nullable(),
  }).strict(),
}).strict();

export type StudioOptions = z.infer<typeof studioOptionsSchema>;

import {
  estActive, groupesAtteignables, portraitSchema, valideSelection,
  type Portrait, type StartGenerationInput, type StudioConfig, type StudioSelection,
} from "@lehno/contracts";

/* « Aperçu et partage d'un portrait » — §3.22, séparé de son affichage.
 *
 * Même motif que la génération, le carnet et la note : `react-native` est typé
 * en Flow, et ni esbuild ni Vitest ne savent le lire. Les décisions vivent donc
 * ici, où les tests les chargent, et l'écran ne fait que les appliquer.
 *
 * CE QUI SE DÉCIDE ICI, ET NULLE PART AILLEURS :
 *
 * — LE PORTRAIT EST UNE IMAGE, PAS UNE PAGE. « L'application ne compose rien :
 *   le portrait est une image, son assemblage appartient au serveur, et l'écran
 *   affiche ce que l'API rend. » Aucune fonction d'ici ne fabrique donc une
 *   composition ; elles ne font que dire quoi montrer et quoi envoyer.
 *
 * — L'IMAGE N'EXISTE QU'APRÈS L'APPROBATION. `portraitSchema` le dit :
 *   « l'image composée, produite à l'approbation » — avant elle, `imageUrl` est
 *   nulle. Un écran qui offrirait « Enregistrer » avant d'approuver ouvrirait
 *   une feuille de partage sur rien. D'où trois états, et non deux : le
 *   troisième est le moment — bref, mais réel — où le portrait est approuvé et
 *   son image pas encore là.
 *
 * — LE PORTRAIT NE S'EXPOSE À AUCUNE ADRESSE PUBLIQUE. Le contrat l'écrit :
 *   « l'utilisateur l'enregistre et l'envoie lui-même ». C'est pourquoi on ne
 *   trouvera ici NI mise au mur NI retrait du mur — voir plus bas, où le refus
 *   est motivé plutôt que passé sous silence.
 *
 * — LA RELECTURE N'EST PAS SOUS LE DRAPEAU. Comme pour le message : éteindre
 *   `generation.portrait` retire « Refaire », jamais la lecture ni le partage
 *   d'un portrait déjà payé. Le serveur applique exactement la même règle — le
 *   drapeau est sur le lancement, pas sur la lecture. C'est pour cela que seule
 *   `offreDeRefaire` prend les drapeaux en paramètre.
 */

/* Ce qu'on forme et ce qu'on envoie, chemin et corps ensemble — le motif de
   `envoiDeLaNote` et de `correctionDuMessage`. L'écran choisit le verbe. */
export interface Envoi {
  chemin: string;
  corps: CorpsDePortrait | StartGenerationInput;
}

/* Ce qu'un PATCH de portrait porte : l'approbation, et la note de l'expéditeur.
 *
 * PAS DE SCHÉMA ZOD À IMPORTER, et ce n'est pas un oubli : le contrat commun
 * n'en publie aucun pour cette requête — voir l'avertissement sur les chemins,
 * plus bas. On décrit donc ce que la spécification technique §5.4 arrête
 * (« Approuver, modifier le message ou la note de l'expéditeur »), en n'en
 * gardant que ce que l'écran §3.22 sait faire. Le jour où le schéma paraît,
 * c'est ce type-là qui disparaît, et le compilateur nommera les appelants. */
export interface CorpsDePortrait {
  status?: "approved";
  /* NULLABLE, jamais absent quand on le change : `senderNote` est nullable au
     contrat, et « retirer la signature » se dit `null`. L'omettre voudrait dire
     « ne touche pas », c'est-à-dire l'inverse du geste. */
  senderNote?: string | null;
}

/* ⚠ CES CHEMINS SONT SPÉCIFIÉS, PAS ENCORE PUBLIÉS.
 *
 * `docs/api/openapi.json` ne décrit aucun chemin de portrait : il n'y a ni
 * lecture, ni approbation, ni image. Ce qui existe, c'est
 * `spec-technique-lehno.md` §5.4 — « `/me/portraits/{id}` PATCH : approuver,
 * modifier le message ou la note de l'expéditeur » — et le registre des
 * drapeaux, qui range `/me/portraits/*` sous `generation.portrait` et se trouve
 * dans le contrat engendré.
 *
 * On s'en tient donc à ce que la spécification arrête, et on le rassemble ICI
 * plutôt que de l'éparpiller dans l'écran : le jour où le contrat publie ces
 * chemins, il n'y a qu'un endroit à corriger, et le jour où il en publie
 * d'autres, la divergence se voit en une lecture. */
const RACINE = "/me/portraits";

// ── L'ouverture de l'écran ──────────────────────────────────────────────────

export type Ouverture =
  | { sorte: "lire"; chemin: string }
  | { sorte: "sans-objet" };

/* UN PARAMÈTRE DE ROUTE N'EST PAS DE CONFIANCE : les routes d'expo-router
 * s'atteignent par lien profond, donc `…/portrait?id=<n'importe quoi>` est une
 * entrée non fiable, au même titre qu'un corps de requête.
 *
 * On ne se contente pas de vérifier qu'il est non vide : la forme se demande au
 * CONTRAT — `portraitSchema.shape.id` est un uuid, et c'est lui qui décide.
 * Recopier une expression rationnelle ici en ferait une seconde vérité, qui
 * dériverait le jour où l'identifiant change de forme.
 *
 * Sans identifiant recevable il n'y a rien à lire, et surtout rien à relancer :
 * ouvrir une génération pour se donner quelque chose à montrer débiterait un
 * crédit que personne n'a demandé. L'écran le dit par son état vide. */
export function ouverture(id: string | undefined): Ouverture {
  const lu = portraitSchema.shape.id.safeParse(id);
  if (!lu.success) return { sorte: "sans-objet" };
  return { sorte: "lire", chemin: `${RACINE}/${lu.data}` };
}

// ── Les trois moments du même écran ─────────────────────────────────────────

export type Etat = "avalider" | "composition" | "pret";

/* TROIS ÉTATS, ET LE TROISIÈME EST CELUI QU'ON OUBLIE.
 *
 * `generated` → il reste à approuver, et l'approbation est le geste mis en
 * avant : c'est elle qui déclenche la composition de l'image.
 *
 * `approved` AVEC image → tout est là : on enregistre, on partage.
 *
 * `approved` SANS image → l'approbation est passée, la composition n'a pas
 * encore rendu. C'est la combinaison qui piège : la traiter comme « prêt »
 * afficherait un cadre vide et ouvrirait une feuille de partage sur une adresse
 * nulle. On la nomme, l'écran l'attend. */
export function etatDuPortrait(portrait: Portrait): Etat {
  if (portrait.status !== "approved") return "avalider";
  return portrait.imageUrl ? "pret" : "composition";
}

// ── Approuver ───────────────────────────────────────────────────────────────

/* « Le portrait passe de produit à validé, et rejoint la collection du
 * proche » — et c'est le moment où l'image se compose.
 *
 * ON N'APPROUVE PAS DEUX FOIS. Un portrait déjà `approved` recomposerait-il son
 * image ? Personne ne le sait, et c'est bien le problème : un second appel
 * risque de refaire un travail payé, ou d'échouer sur un état que l'écran
 * croyait sûr. Rendre `null` retire le bouton plutôt que d'offrir un geste dont
 * on ignore l'effet. */
export function approbation(portrait: Portrait): Envoi | null {
  if (portrait.status === "approved") return null;
  return { chemin: `${RACINE}/${portrait.id}`, corps: { status: "approved" } };
}

// ── La signature en pied ────────────────────────────────────────────────────

/* La note de l'expéditeur — « Fait avec soin par Valentine », sous le message.
 *
 * ELLE SE RETIRE ET SE REMET, et l'état « retirée » est `null`, jamais la
 * chaîne vide : une chaîne vide serait une note qui existe et ne s'affiche pas,
 * et le gabarit lui garderait sa place dans la bande. C'est la même règle que
 * le nom affiché du profil, pour la même raison.
 *
 * RIEN NE PART SI RIEN NE CHANGE. Ouvrir l'écran, effleurer l'interrupteur puis
 * le remettre est le geste le plus banal d'ici ; il ne doit pas laisser deux
 * écritures derrière lui. On compare donc à ce que le SERVEUR porte.
 *
 * Le pied de marque, lui, n'est pas concerné : « le logotype reste toujours »,
 * il fait partie de l'image et aucun réglage ne l'ôte. */
export function changementDeSignature(portrait: Portrait, voulue: string | null): Envoi | null {
  const propre = voulue === null ? null : voulue.trim();
  const cible = propre === "" ? null : propre;
  if (cible === portrait.senderNote) return null;
  return { chemin: `${RACINE}/${portrait.id}`, corps: { senderNote: cible } };
}

/* Ce que l'interrupteur remet quand on le rallume.
 *
 * Le portrait garde sa note tant qu'on ne l'a pas retirée ; une fois retirée,
 * il n'y a plus rien à remettre — d'où le nom d'usage du compte comme repli.
 * Sans nom affiché, le pseudo : mieux vaut « Fait avec soin par valentine » que
 * « Fait avec soin par », qui se lirait comme une panne. */
export function signatureARemettre(
  portrait: Portrait,
  connue: string | null,
  parDefaut: string,
): string {
  return portrait.senderNote ?? connue ?? parDefaut;
}

// ── Enregistrer et partager ─────────────────────────────────────────────────

/* Ce qu'on dépose dans la feuille de partage du téléphone.
 *
 * DEUX SORTES, ET C'EST LE SYSTÈME QUI L'IMPOSE. `Share.share` de React Native
 * ne prend `url` que sur iOS ; sur Android il ne lit que `message` et `title`,
 * et l'adresse passée en `url` y est ignorée SANS ERREUR — le bouton s'anime,
 * la feuille s'ouvre, et elle est vide. C'est le pire des défauts : silencieux.
 *
 * On nomme donc ce qu'on dépose. « fichier » est l'image elle-même, telle que
 * §3.22 la veut ; « adresse » est le repli, où c'est le lien vers l'image qui
 * circule. Le repli n'est pas ce que le produit promet — « on partage un
 * fichier, pas une adresse » — mais il vaut mieux qu'un geste muet.
 *
 * On redit ces formes ici plutôt que d'importer `ShareContent` : ce module ne
 * charge pas `react-native`, c'est toute sa raison d'être. */
export type Feuille =
  | { sorte: "fichier"; url: string; message?: string }
  | { sorte: "adresse"; message: string };

export type SorteDePartage = "enregistrer" | "partager";

/* Là où `Share.share` sait déposer un fichier — c'est-à-dire iOS, et lui seul.
 *
 * C'est ce qui décide si « Enregistrer l'image » a un sens : la feuille y met
 * « Enregistrer l'image » à côté des messageries, et c'est ainsi que §3.22
 * range les deux gestes au même endroit. Ailleurs, il n'y a rien à enregistrer
 * — envoyer un lien dans la pellicule n'enregistre aucune image —, et le bouton
 * ne s'affiche pas plutôt que de ne rien faire.
 *
 * Écrire l'image sur le téléphone hors de la feuille demanderait un module
 * natif que l'application n'embarque pas ; c'est signalé plutôt que bricolé. */
export function laFeuilleDeposeUnFichier(plateforme: Plateforme): boolean {
  return plateforme === "ios";
}

/* La plateforme, dite par son nom plutôt que par un booléen : « estIOS » se
   lirait comme une exception à corriger, alors que c'est une différence de
   capacité entre deux systèmes. */
export type Plateforme = "ios" | "android" | "autre";

/* UNE SEULE FEUILLE, DEUX CHARGES. §3.22 range les deux gestes au même endroit
 * — « partager / enregistrer → feuille de partage du téléphone ».
 *
 * Ce qui les distingue, c'est ce qu'on y dépose. « Partager » joint le mot :
 * « l'application ouvre la feuille avec l'image, accompagnée d'un mot ».
 * « Enregistrer » ne joint rien — un texte collé dans la pellicule n'irait
 * nulle part, et il ferait basculer la feuille en partage de texte, l'image en
 * pièce jointe muette.
 *
 * SANS IMAGE, RIEN. Tant que la composition n'a pas rendu, il n'y a pas de
 * fichier : ouvrir la feuille sur une adresse nulle proposerait de partager le
 * vide. L'écran n'affiche pas les boutons plutôt que de les griser.
 *
 * SANS FICHIER POSSIBLE, PAS D'ENREGISTREMENT — voir `laFeuilleDeposeUnFichier`.
 * Le partage, lui, se replie sur l'adresse : le mot et le lien valent mieux que
 * rien du tout. */
export function feuilleDePartage(
  portrait: Portrait,
  sorte: SorteDePartage,
  mot: string,
  plateforme: Plateforme,
): Feuille | null {
  if (!portrait.imageUrl) return null;
  const propre = mot.trim();

  if (!laFeuilleDeposeUnFichier(plateforme)) {
    if (sorte === "enregistrer") return null;
    /* Le lien EN DERNIER, sur sa propre ligne : les messageries n'en font un
       aperçu que s'il termine le message, et collé au texte elles avalent la
       ponctuation dans l'adresse. */
    return { sorte: "adresse", message: propre === "" ? portrait.imageUrl : `${propre}\n${portrait.imageUrl}` };
  }

  if (sorte === "enregistrer") return { sorte: "fichier", url: portrait.imageUrl };
  return propre === ""
    ? { sorte: "fichier", url: portrait.imageUrl }
    : { sorte: "fichier", url: portrait.imageUrl, message: propre };
}

/* Le mot qui accompagne l'image : la version courte quand elle existe, le
 * message sinon.
 *
 * « `contentShort` peut manquer » — le contrat le dit du message, et le
 * portrait le porte de la même façon, nullable. On se replie sur le texte long
 * plutôt que de partager une image nue : c'est le mot qui dit à qui la reçoit
 * pourquoi on la lui envoie. */
export function motDAccompagnement(portrait: Portrait): string {
  return portrait.contentShort ?? portrait.content;
}

/* CE QUI N'EST PAS ICI, ET POURQUOI — la mise au mur.
 *
 * La maquette pose « Partager sur mon Mur » et « Retirer de mon Mur ». Le
 * contrat les refuse, et pas par omission : `portraitSchema` écrit que « le
 * portrait ne s'expose à AUCUNE adresse publique — l'utilisateur l'enregistre
 * et l'envoie lui-même », et §3.22 ne liste que quatre actions, dont aucune
 * n'est une publication. `updateWallSchema`, de son côté, ne porte que
 * `publicInterestIds` : il n'existe aucun champ où loger un portrait.
 *
 * Un bouton qui n'a ni champ ni chemin ne se code pas « en attendant » : il
 * échouerait au premier appui, et sur une promesse — rendre une image publique
 * — qu'on ne peut pas tenir à moitié. Il est donc absent, et signalé. */

// ── Refaire, qui coûte un crédit ────────────────────────────────────────────

/* Le drapeau garde la PRODUCTION, pas la relecture — même règle que pour le
 * message, et le serveur l'applique déjà ainsi : « éteindre une nature doit
 * empêcher d'en produire de nouvelles, jamais de relire ce qu'on a déjà payé ».
 *
 * Éteint, « Refaire » disparaît ; le portrait déjà payé se lit, s'approuve,
 * s'enregistre et se partage toujours. */
export function offreDeRefaire(actives: readonly string[]): boolean {
  return estActive(actives, "generation.portrait");
}

/* « Régénérer — relancer avec d'autres mots, une autre plage ou un autre ton
 * (nouveau crédit) ». C'est une NOUVELLE demande, pas une reprise.
 *
 * Elle vise le PROCHE, jamais l'occasion : `startGenerationSchema` l'impose —
 * « un portrait vise un proche », « un portrait ne vise pas une occasion ». Le
 * test repasse le corps formé dans le schéma réel, pour que cette règle ne soit
 * pas redite ici de mémoire.
 *
 * Sans sélection recevable, on ne relance pas : le serveur revérifiera de toute
 * façon — il décide seul — mais un refus après débit serait un crédit perdu
 * pour une demande que le client savait incohérente. */
export function relanceDuPortrait(
  personId: string,
  catalogue: StudioConfig,
  selection: StudioSelection,
): Envoi | null {
  if (valideSelection(catalogue, selection).length > 0) return null;
  return {
    chemin: "/me/generations",
    corps: { kind: "portrait", personId, studioSelection: { ...selection } },
  };
}

// ── Le studio, tel que le serveur le sert ───────────────────────────────────

/* LA VOIE ET L'AMBIANCE VIENNENT DU CATALOGUE, jamais d'une liste écrite ici.
 *
 * La maquette dessine six pastilles — illustration / photo / aucune, puis
 * papier / lilas / encre — et le dictionnaire porte leurs libellés. Les employer
 * serait pourtant une faute : le contrat pose que « le serveur rend le
 * catalogue, l'utilisateur choisit dedans », que « les libellés arrivent déjà
 * résolus dans la langue demandée », et qu'une option ajoutée en administration
 * doit paraître « sans livraison ». Une liste embarquée rendrait muette toute
 * ambiance nouvelle sur les applications déjà installées.
 *
 * L'écran affiche donc ce que `groupesAtteignables` rend, dans cet ordre, sans
 * savoir ce qu'est une voie d'image ni une famille d'illustration. */

/* Ce qu'on propose à l'ouverture : le défaut de chaque groupe ATTEIGNABLE.
 *
 * Pas de tous les groupes : un défaut posé sur un groupe que rien n'a ouvert
 * serait « hors-portée » au sens de `valideSelection`, et bloquerait la relance
 * dès le premier rendu — sur un écran où personne n'a rien touché. */
export function selectionParDefaut(catalogue: StudioConfig): StudioSelection {
  return complete(catalogue, {});
}

/* Répondre par le défaut à tout groupe atteignable resté sans réponse.
 *
 * La liste des atteignables DÉPEND de ce qu'on vient de poser — répondre à un
 * groupe en ouvre un autre. On la redemande donc à chaque tour plutôt que de la
 * calculer une fois : sinon les groupes révélés par les défauts resteraient
 * sans réponse, et `valideSelection` les dirait « manquants » sur un écran où
 * personne n'a rien touché. Le compteur borne la boucle sur le nombre de
 * groupes — un catalogue ne peut pas en ouvrir davantage qu'il n'en porte. */
function complete(catalogue: StudioConfig, base: StudioSelection): StudioSelection {
  const parId = new Map(catalogue.groups.map((g) => [g.id, g]));
  const selection: StudioSelection = { ...base };
  for (let garde = 0; garde <= catalogue.groups.length; garde += 1) {
    const suivant = groupesAtteignables(catalogue, selection)
      .find((id) => selection[id] === undefined);
    if (suivant === undefined) break;
    selection[suivant] = parId.get(suivant)!.defaultChoiceId;
  }
  return selection;
}

/* Choisir, puis ÉLAGUER ce que ce choix a refermé.
 *
 * C'est le piège du catalogue à révélations : on choisit « une illustration »,
 * sa famille apparaît, on répond « animal » — puis on repasse à « aucune
 * image ». Le groupe des familles disparaît de l'écran, mais la réponse reste
 * dans la sélection, et `valideSelection` la refuse alors comme
 * « hors-portée ». Le bouton « Refaire » s'éteignait sans que rien à l'écran ne
 * dise pourquoi : le groupe fautif n'était plus affiché.
 *
 * On garde les réponses encore atteignables, on jette les autres, et on
 * complète par les défauts de ce que le nouveau choix vient d'ouvrir. */
export function apresLeChoix(
  catalogue: StudioConfig,
  selection: StudioSelection,
  groupId: string,
  choiceId: string,
): StudioSelection {
  const pose: StudioSelection = { ...selection, [groupId]: choiceId };
  const ouverts = new Set(groupesAtteignables(catalogue, pose));
  const elaguee: StudioSelection = {};
  for (const [id, choix] of Object.entries(pose)) {
    if (ouverts.has(id)) elaguee[id] = choix;
  }
  /* Les défauts se posent APRÈS l'élagage, et sur ce qu'il reste : les calculer
     d'avance donnerait ceux du catalogue au repos, c'est-à-dire des réponses à
     des groupes que le nouveau choix vient justement de refermer. */
  return complete(catalogue, elaguee);
}

// Le catalogue des modèles d'IA et les chaînes de repli — spécification
// technique §1 et §5.4.
//
// Même partage que les drapeaux : le REGISTRE vit dans le code, l'ÉTAT vit en
// base. Ici : quels modèles existent, ce que chacun sait faire, et dans quel
// ordre les essayer par défaut. En base : le rang réglé par l'administration,
// l'interrupteur, le tarif, et l'état de panne.
//
// Pourquoi en code : sans registre, un serveur neuf démarre avec un catalogue
// vide et aucune génération ne fonctionne tant qu'un humain n'a rien saisi. Le
// registre est ce qui rend l'application utilisable au premier démarrage.

export type CapaciteIA = "text" | "image";

// Les tâches qui appellent un modèle. Le vocabulaire est celui de PromptKind,
// qui existait avant : deux énumérations nommant la même chose autrement
// finissent toujours par diverger, et c'est le genre de divergence qu'on
// découvre en production sur une clé de gabarit introuvable.
export const TACHES_IA = [
  "note_classification",
  "sensitive_detection",
  "message",
  "gift_ideas",
  /* Le texte qui PRÉCÈDE l'image : il lit les notes et rend les mots qui
     comptent. Ce sont eux qui partent au modèle d'image, jamais les notes. */
  "portrait_brief",
  "illustration",
  "photo_style",
] as const;

export type TacheIA = (typeof TACHES_IA)[number];

// Ce que chaque tâche exige d'un modèle. Ranger un modèle de texte sur une
// tâche d'image ne se verrait pas à la configuration : ça échouerait à la
// première génération, en production, sur un contenu déjà facturé.
export const CAPACITE_REQUISE: Record<TacheIA, CapaciteIA> = {
  note_classification: "text",
  sensitive_detection: "text",
  message: "text",
  gift_ideas: "text",
  portrait_brief: "text",
  illustration: "image",
  photo_style: "image",
};

export type EntreeModele = {
  readonly fournisseur: string;
  readonly modele: string;
  readonly capacite: CapaciteIA;
};

/* Le catalogue. La clé est « fournisseur:modèle » — c'est l'unicité que porte
   la base, et s'en écarter ici créerait un doublon au premier démarrage.

   Les clés sont celles que les API DÉCLARENT — vérifiées en interrogeant
   /v1/models, pas recopiées d'une documentation. « grok-4 » et « grok-2-image »
   y figuraient d'abord : le premier répond par alias, le second n'existe pas du
   tout et rendait 404. Une clé de modèle inventée ne se voit qu'au premier
   appel réel, c'est-à-dire chez l'utilisateur.

   AUCUN TARIF n'est déclaré. Les prix changent sans nous prévenir, et un tarif
   périmé dans le code produirait des estimations de coût qui ont l'air de faire
   foi. Non tarifé veut dire « on ne sait pas », et l'administration le voit. */
export const MODELES_IA: Record<string, EntreeModele> = {
  "anthropic:claude-opus-5": { fournisseur: "anthropic", modele: "claude-opus-5", capacite: "text" },
  "anthropic:claude-sonnet-5": { fournisseur: "anthropic", modele: "claude-sonnet-5", capacite: "text" },
  "anthropic:claude-haiku-4-5-20251001": { fournisseur: "anthropic", modele: "claude-haiku-4-5-20251001", capacite: "text" },
  "deepseek:deepseek-chat": { fournisseur: "deepseek", modele: "deepseek-chat", capacite: "text" },
  "deepseek:deepseek-reasoner": { fournisseur: "deepseek", modele: "deepseek-reasoner", capacite: "text" },
  "xai:grok-4.6": { fournisseur: "xai", modele: "grok-4.6", capacite: "text" },
  "xai:grok-imagine-image": { fournisseur: "xai", modele: "grok-imagine-image", capacite: "image" },
  /* `gpt-image-2` en tête des chaînes d'image, et voici ce qui l'y met — trois
     apports qui touchent exactement ce que le portrait demande :
     - LE RENDU DU TEXTE : texte dense, petits caractères, jeux de caractères
       multilingues, mises en page complexes. Le portrait porte une bande de
       texte par-dessus le motif, et c'est le point faible historique des
       modèles d'image — celui qui obligeait à envisager de composer le texte
       nous-mêmes.
     - LE SUIVI D'INSTRUCTION : le modèle est nativement multimodal, l'image
       n'est pas un système à part. Nos ambiances sont des consignes en
       français, pas des mots-clés.
     - LA COHÉRENCE DES VISAGES entre variantes, qui décidera de la voie
       « photo » quand elle viendra.
     `gpt-image-1` RESTE au catalogue : une configuration publiée peut le
     désigner, et le retirer casserait ce qui tourne. */
  "openai:gpt-image-2": { fournisseur: "openai", modele: "gpt-image-2", capacite: "image" },
  "openai:gpt-image-1": { fournisseur: "openai", modele: "gpt-image-1", capacite: "image" },
};

export const CLES_MODELES = Object.keys(MODELES_IA);

/* Les chaînes de départ : rang 1 en premier, puis 2, puis 3.
 *
 * L'ordre suit ce que chaque tâche coûte et ce qu'elle risque, pas une qualité
 * abstraite. Le classement tourne sur CHAQUE note en arrière-plan sans que
 * personne n'attende : le volume commande, donc le plus petit modèle. Le
 * message est payé en crédits et lu par un humain : il prend le meilleur.
 *
 * `sensitive_detection` est la seule tâche de fond qui ne suit PAS l'économie.
 * Elle a le volume du classement, mais son erreur ne se rattrape pas côté
 * utilisateur : un événement mal jugé fait envoyer un « bonne fête » sur un
 * anniversaire de décès. Elle est donc volontairement un cran au-dessus.
 *
 * Un piège de coût, mesuré : sur une invite de cinq mots, grok-4.6 compte 642
 * jetons d'entrée là où les modèles d'Anthropic en comptent 16. Sa consigne
 * interne est facturée à chaque appel. Il reste en dernier rang du classement
 * des notes — la tâche au plus gros volume — précisément pour ça : il n'y est
 * appelé que si les deux autres sont tombés.
 *
 * Les chaînes d'image n'ont que deux fournisseurs. Ce n'est pas un oubli :
 * parmi ceux retenus, seuls xAI et OpenAI produisent des images. Elles ont trois
 * rangs quand même, les deux modèles d'OpenAI encadrant celui de xAI.
 *
 * `gpt-image-2` PASSE DEVANT, et pas par nouveauté : c'est le rendu de texte qui
 * décide. Le portrait porte une bande de texte, et un modèle qui écrit mal
 * oblige à composer ce texte soi-même — un tout autre travail.
 *
 * Un écart de POIDS mesuré sur la version 1, à revérifier sur la 2 : xAI rend
 * ~130 Ko de base64, OpenAI ~1,8 Mo. Treize fois plus, et cette chaîne traverse
 * la mémoire du serveur en entier. */
export const CHAINES_PAR_DEFAUT: Record<TacheIA, readonly string[]> = {
  note_classification: [
    "anthropic:claude-haiku-4-5-20251001",
    "deepseek:deepseek-chat",
    "xai:grok-4.6",
  ],
  sensitive_detection: [
    "anthropic:claude-sonnet-5",
    "anthropic:claude-haiku-4-5-20251001",
    "deepseek:deepseek-chat",
  ],
  message: [
    "anthropic:claude-opus-5",
    "anthropic:claude-sonnet-5",
    "deepseek:deepseek-reasoner",
  ],
  gift_ideas: [
    "anthropic:claude-sonnet-5",
    "deepseek:deepseek-chat",
    "xai:grok-4.6",
  ],
  /* Le brief prend le MEILLEUR modèle de texte, pas le moins cher. Il décide de
     ce qu'un dessin montrera d'une personne, à partir de ce qu'on a écrit sur
     elle en confidence — et une erreur ici se voit sur l'image, après paiement.
     Même arbitrage que le message, pour la même raison. */
  portrait_brief: [
    "anthropic:claude-opus-5",
    "anthropic:claude-sonnet-5",
    "deepseek:deepseek-reasoner",
  ],
  illustration: ["openai:gpt-image-2", "xai:grok-imagine-image", "openai:gpt-image-1"],
  photo_style: ["openai:gpt-image-2", "xai:grok-imagine-image", "openai:gpt-image-1"],
};

/* Le disjoncteur. Trois échecs D'AFFILÉE écartent un modèle pour cinq minutes.
 *
 * Trois, parce qu'un seul échec est du bruit et qu'attendre le dixième laisse
 * neuf générations tomber. Cinq minutes, parce qu'une panne de fournisseur dure
 * rarement moins, et qu'une éviction plus longue priverait de son primaire bien
 * après le rétablissement — sans que personne ne pense à aller le rallumer. */
export const SEUIL_PANNE = 3;
export const DUREE_PANNE_MS = 5 * 60 * 1000;

/* En dessous de trois rangs, ou avec un fournisseur répété dans la chaîne, on
   AVERTIT sans refuser. Refuser rendrait les tâches d'image inconfigurables —
   deux fournisseurs seulement en produisent — et transformerait un jugement
   d'exploitation en interdit. */
export const RANGS_RECOMMANDES = 3;

/* Les actions qui consomment des crédits.
 *
 * Les codes viennent du dictionnaire et ne recouvrent PAS les valeurs de
 * `TACHES_IA`, à dessein : ici c'est ce que l'utilisateur ACHÈTE, là c'est ce
 * qu'un appel de modèle a SERVI. Un portrait est **une** action payante et
 * **plusieurs** appels — le texte, puis l'image. Les fondre ferait disparaître
 * l'un des deux comptages, et c'est justement leur écart qui donne la marge.
 *
 * Le prix vit en base, jamais ici : il se règle en administration sans
 * livraison. Ce registre ne pose que l'existence et un prix de départ. */
export const ACTIONS_PAYANTES: Record<string, { readonly libelle: string; readonly cout: number }> = {
  gift_ideas: { libelle: "Des idées de cadeaux", cout: 1 },
  portrait: { libelle: "Un portrait", cout: 1 },
  // Le message de vœux. Le dictionnaire le nomme ainsi ; `PromptKind` l'appelle
  // `message`. Ce sont deux axes différents, et le nom suit celui de son axe.
  wish_message: { libelle: "Un message", cout: 1 },
};

export const CODES_ACTIONS_PAYANTES = Object.keys(ACTIONS_PAYANTES);

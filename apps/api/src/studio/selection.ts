import {
  GROUPES_AMBIANCE, ORIENTATIONS,
  type GroupeAmbiance, type Orientation, type ReglagesPortrait, type VoieImage,
} from "@lehno/contracts";
import { AppError } from "../common/errors.js";

/**
 * La sélection du studio, vérifiée contre le catalogue PUBLIÉ.
 *
 * Le contrat commun l'annonce depuis le début — « la cohérence se vérifie
 * contre le catalogue reçu, puis **de nouveau côté serveur, qui décide seul** »
 * — et ce second contrôle n'existait pas.
 *
 * CE QU'IL EMPÊCHE, concrètement :
 *
 * 1. UNE AMBIANCE DÉSACTIVÉE hier et demandée aujourd'hui. Le parc ne se met
 *    pas à jour d'un bloc : un téléphone garde son catalogue en mémoire, et
 *    l'écran propose encore ce qu'on vient de retirer. Sans ce contrôle, le
 *    crédit part et le modèle produit dans un style qu'on ne veut plus servir.
 *
 * 2. UNE AMBIANCE DU MAUVAIS GROUPE — un style de photo demandé sur la voie
 *    illustration. Les deux passent par des modèles différents ; les confondre
 *    enverrait la consigne d'un dessin à un traitement de photo.
 *
 * 3. UNE VOIE INACTIVE. `photo` l'est aujourd'hui, faute de styles nommés. Un
 *    client qui la demanderait obtiendrait un écran sans suite après paiement.
 *
 * LE REFUS TOMBE AVANT LE DÉBIT, comme les deux gardes du contrôleur de
 * génération. C'est la seule position qui vaille : un refus après débit oblige
 * à rembourser, et un remboursement qui échoue laisse un crédit perdu.
 */
export type SelectionPortrait = {
  readonly orientation: Orientation;
  readonly voie: VoieImage;
  /* LA COMPOSITION — le SECOND paramètre que le client donne. Le type de rendu
     dit ce qu'on dessine ; la composition dit dans quelle gamme et sur quel
     fond ça se pose. Sa palette part au modèle d'image ; son fond et son cadre
     sont posés par `PortraitComposition`, côté client. */
  readonly composition: { readonly id: string; readonly palette: readonly [string, string, string, string] };
  /** Nulle sur la voie « aucune » : elle n'ouvre aucun groupe d'ambiance. */
  readonly ambiance: { readonly id: string; readonly groupe: GroupeAmbiance; readonly consigne: { fr: string; en: string } } | null;
};

/* La voie « aucune » ne fait AUCUN appel de modèle : le motif de marque tient
   tout le fond. C'est le catalogue qui le dit, et le repérer ici évite d'aller
   chercher une ambiance qui ne viendra jamais. */
const GROUPE_OUVERT: Record<VoieImage, GroupeAmbiance | null> = {
  illustration: "illustration_family",
  photo: "photo_style",
  aucune: null,
};

const EST_ORIENTATION = (v: string): v is Orientation =>
  (ORIENTATIONS as readonly string[]).includes(v);

export function verifierLaSelection(
  reglages: ReglagesPortrait,
  selection: Record<string, string> | undefined,
): SelectionPortrait {
  const brut = selection ?? {};

  /* `validation_failed` et non `not_found` : la demande est mal formée, elle ne
     désigne pas une ressource absente. L'écran doit dire « ce choix n'est plus
     proposé », pas « cette page n'existe pas ». */
  const refus = (quoi: string): never => {
    throw new AppError("validation_failed", `studio selection: ${quoi}`);
  };

  const orientation = brut["orientation"];
  if (orientation === undefined || !EST_ORIENTATION(orientation))
    return refus("unknown orientation");

  /* LA COMPOSITION SE VÉRIFIE COMME LE RESTE, et avant le débit. Une gamme
     retirée du catalogue hier et demandée aujourd'hui ferait dessiner sur un
     fond qu'on ne sert plus — un lilas sur un fond d'encre qu'on vient de
     supprimer, illisible. */
  const compositionDemandee = brut["composition"];
  if (compositionDemandee === undefined) return refus("a composition is required");
  const composition = reglages.compositions.find((c) => c.id === compositionDemandee);
  if (!composition) return refus("unknown composition");
  if (!composition.actif) return refus(`composition "${compositionDemandee}" is not offered`);

  const voie = brut["visual"];
  const voieReglee = reglages.voiesImage.find((v) => v.id === voie);
  if (!voieReglee) return refus("unknown visual path");
  if (!voieReglee.actif) return refus(`visual path "${voie}" is not offered`);

  const groupe = GROUPE_OUVERT[voieReglee.id];
  if (groupe === null) {
    /* La voie « aucune » n'ouvre rien. Une ambiance envoyée avec elle est un
       client qui n'a pas suivi le catalogue — on le dit plutôt que de
       l'ignorer, sinon il croira que son choix a porté. */
    if (brut["photoStyle"] !== undefined || brut["illustrationFamily"] !== undefined)
      return refus("this visual path takes no ambiance");
    return {
      orientation, voie: voieReglee.id, ambiance: null,
      composition: { id: composition.id, palette: composition.palette },
    };
  }

  /* Le client nomme l'ambiance sous la clé de SON groupe. Chercher les deux et
     retenir celle qui répond évite au serveur de connaître la convention de
     nommage du client — le contrat dit qu'il « transporte, il ne juge pas ». */
  const demandee = brut["photoStyle"] ?? brut["illustrationFamily"] ?? brut["ambiance"];
  if (demandee === undefined) return refus(`an ambiance is required for "${voieReglee.id}"`);

  const ambiance = reglages.ambiances.find((a) => a.id === demandee);
  if (!ambiance) return refus("unknown ambiance");
  if (!ambiance.actif) return refus(`ambiance "${demandee}" is not offered`);
  /* LE GROUPE, et c'est le contrôle qui compte le plus : un style de photo
     demandé sur la voie illustration passerait par le mauvais modèle, et la
     consigne d'un dessin partirait à un traitement de photo. */
  if (ambiance.groupe !== groupe)
    return refus(`ambiance "${demandee}" does not belong to "${voieReglee.id}"`);

  return {
    orientation,
    voie: voieReglee.id,
    ambiance: { id: ambiance.id, groupe: ambiance.groupe, consigne: ambiance.consigne },
    composition: { id: composition.id, palette: composition.palette },
  };
}

/** Le groupe qu'une voie ouvre — exporté pour que la production et l'essai du
 *  studio lisent la MÊME table. Deux copies dériveraient. */
export const groupeDeLaVoie = (voie: VoieImage): GroupeAmbiance | null => GROUPE_OUVERT[voie];

export { GROUPES_AMBIANCE };

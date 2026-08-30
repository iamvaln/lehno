import { SetMetadata } from "@nestjs/common";

export const OUVERT_EN_SUPPRESSION = "ouvert_en_suppression";

/**
 * Ouvre une route à un compte dont la suppression est demandée.
 *
 * LA PIÈCE EST VIDE PAR DÉFAUT, et c'est tout l'intérêt : la garde refuse
 * `pending_deletion` sur tout, et seules les routes qui portent ce marqueur
 * s'ouvrent. Une route ajoutée demain arrive donc fermée — l'inverse la
 * laisserait ouverte jusqu'à ce que quelqu'un pense à la fermer, ce qui est le
 * sens dans lequel un oubli coûte cher.
 *
 * Un compte en suppression a UNE chose à faire dans l'application : revenir sur
 * sa décision. Tout le reste — noter, générer, payer — n'a pas de sens sur un
 * compte qui part, et pourrait même le faire repartir dans la file.
 */
export const OuvertEnSuppression = (): MethodDecorator & ClassDecorator =>
  SetMetadata(OUVERT_EN_SUPPRESSION, true);

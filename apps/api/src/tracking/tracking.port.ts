/* La couche d'abstraction que §16.5 demande : le code émet un événement nommé,
 * l'adaptateur s'occupe du reste. Changer d'outil — ou rapatrier PostHog sur
 * le VPS le jour où le volume le justifie — se limite alors à un fichier. */
export type EvenementSortant = {
  readonly name: string;
  readonly properties: Record<string, unknown>;
  readonly common: Record<string, unknown>;
};

export interface TrackingPort {
  capture(evenement: EvenementSortant): Promise<void>;
}

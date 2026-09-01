/* L'envoi vers le téléphone, derrière une frontière.
 *
 * Même forme que MailPort et StockagePort, et pour la même raison : les tests
 * n'appellent jamais OneSignal, et le développement local n'a pas besoin d'un
 * compte pour voir ce qui serait parti.
 *
 * Une notification poussée porte un TEXTE, pas une clé. C'est le système
 * d'exploitation qui l'affiche, sur un écran verrouillé, sans que
 * l'application soit ouverte : personne ne peut la rendre à notre place. La
 * phrase se compose donc en amont, dans @lehno/i18n, et arrive ici toute
 * faite.
 */
export type EnvoiPousse = {
  /* Les jetons d'abonnement des appareils de LA MÊME personne.
   *
   * Un jeton par installation : le même téléphone réinstallé en produit un
   * nouveau. On les envoie ensemble parce que c'est la même nouvelle, et
   * qu'un appel par appareil multiplierait les requêtes sans rien gagner. */
  jetons: readonly string[];
  titre: string;
  corps: string;
  /* Ce que l'application lira à l'ouverture pour aller au bon écran. Des
     chaînes seulement : ce champ traverse un tiers, et une structure imbriquée
     s'y déforme sans prévenir. */
  donnees?: Record<string, string>;
};

export interface PushPort {
  /* Lève en cas de refus du service.
   *
   * Le silence serait pire : l'envoi marque la ligne AVANT d'appeler, donc une
   * erreur avalée laisserait une notification comptée comme partie et jamais
   * reçue. Ce qui lève ici devient un `failed` visible dans la file. */
  envoyer(e: EnvoiPousse): Promise<void>;
}

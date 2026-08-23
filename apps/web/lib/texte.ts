// Les messages restent des données pures : une fonction dans la table empêcherait
// de la passer à un composant client, et fermerait la porte à des fichiers de
// messages sérialisés le jour où la traduction sortira du code.
export function interpoler(modele: string, valeurs: Record<string, string | number>): string {
  return modele.replace(/\{(\w+)\}/g, (entier, cle: string) => {
    const valeur = valeurs[cle];
    return valeur === undefined ? entier : String(valeur);
  });
}

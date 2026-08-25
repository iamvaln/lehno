/* Les décisions de l'icône — la charte fixe la famille, la grille et le trait,
   ce fichier les applique. Le rendu vit dans Icon.tsx. */

/* Sous 16 px, un trait de 1,8 se referme sur lui-même et le signe devient une
   tache. Les chevrons et les flèches sont assez fins pour demander la même
   faveur à toute taille. */
export function epaisseurDuTrait(nom: string, taille: number, donnee?: number): number {
  if (donnee != null) return donnee;
  if (taille < 16) return 2;
  return /chevron|arrow/i.test(nom) ? 2 : 1.8;
}

/* La charte nomme les icônes en tirets, comme le web ; lucide-react-native les
   exporte en casse Pascal. La conversion vit ici pour que les écrans continuent
   d'écrire `icon="chevron-right"` — deux conventions de nommage auraient fini
   par diverger.

   Un chiffre n'est pas une frontière de mot : « share-2 » est un nom réel de la
   bibliothèque, et le rendre « ShareTwo » ne trouverait rien. */
export function nomLucide(nom: string): string {
  return nom
    .replace(/-(.)/g, (_, lettre: string) => lettre.toUpperCase())
    .replace(/^(.)/, (_, lettre: string) => lettre.toUpperCase());
}

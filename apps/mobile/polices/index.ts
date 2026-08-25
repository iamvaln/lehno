/* La table que useFonts charge au démarrage.
 *
 * Elle est écrite à la main, et c'est le seul endroit du port où une recopie
 * subsiste : Metro empaquette les fichiers en analysant les require() du code
 * source, donc un chemin construit à l'exécution ne serait jamais empaqueté.
 *
 * La clé est ce que `fontFamily` demande, et elle vient de `nativeFont`. Un nom
 * qui divergerait ne lèverait rien — le système rendrait sa police par défaut.
 * `test/polices.test.ts` compare cette table aux noms dérivés de la charte. */
export const POLICES = {
  "Fraunces-Regular": require("./Fraunces-Regular.ttf"),
  "Fraunces-Medium": require("./Fraunces-Medium.ttf"),
  "Fraunces-Italic": require("./Fraunces-Italic.ttf"),
  "Fraunces-MediumItalic": require("./Fraunces-MediumItalic.ttf"),
  "Karla-Regular": require("./Karla-Regular.ttf"),
  "Karla-Medium": require("./Karla-Medium.ttf"),
  "Karla-Semibold": require("./Karla-Semibold.ttf"),
  "Karla-Bold": require("./Karla-Bold.ttf"),
};

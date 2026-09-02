/* La configuration DYNAMIQUE, évaluée à la construction.
 *
 * `app.json` reste la source de tout ce qui est fixe ; ce fichier n'ajoute que
 * ce qui dépend de l'environnement. Expo lit les deux et passe le premier en
 * argument.
 *
 * POURQUOI PAS UNE VARIABLE `EXPO_PUBLIC_` DE PLUS : Expo n'injecte dans le
 * paquet client que les variables ainsi préfixées, ce qui obligerait à
 * DUPLIQUER `ONESIGNAL_APP_ID` sous un second nom — deux variables pour une
 * seule valeur, qui divergeront le jour où l'on n'en change qu'une.
 *
 * Ici, le fichier s'exécute sur la machine qui construit : il lit la variable
 * telle qu'elle est, et dépose la valeur dans `extra`, que l'application relit
 * par `Constants.expoConfig`.
 *
 * ABSENTE, ON POSE `null` PLUTÔT QUE D'ÉCHOUER. Les notifications sont une
 * commodité : un poste qui n'a pas la variable doit construire et démarrer
 * normalement, sans elles.
 */
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    /* `mode` suit la construction : « development » emploie les certificats de
       développement d'Apple, seuls valides pour un build local ou une diffusion
       interne. En production, il faut « production » — sinon les notifications
       partent vers l'environnement de test d'APNs et n'arrivent jamais. */
    ["onesignal-expo-plugin", { mode: process.env.NODE_ENV === "production" ? "production" : "development" }],
  ],
  extra: {
    ...(config.extra ?? {}),
    oneSignalAppId: process.env.ONESIGNAL_APP_ID ?? null,
  },
});

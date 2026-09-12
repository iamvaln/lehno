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
    /* L'IDENTITÉ DU CLIENT, déposée à la compilation.
     *
     * Ces trois valeurs identifient un build ; elles ne le protègent pas. Elles
     * seront lisibles dans le `.ipa` et dans l'`.apk`, c'est attendu, et ça ne
     * doit surprendre personne à la relecture.
     *
     * PAS DANS `.env` DU DÉPÔT : elles diffèrent par build et par profil EAS,
     * et les figer ici les enverrait toutes au même endroit.
     *
     * `appEnv` COMMANDE UNE EXEMPTION, et c'est pourquoi il ne se déduit pas.
     * Les builds de développement et de recette présentent la paire `staging`,
     * ceux du magasin la paire `prod` — et le serveur décide sur la paire
     * ENREGISTRÉE, jamais sur cette déclaration. L'écart entre les deux est
     * justement l'incident qu'il cherche : un build de recette qui pointe la
     * production. Le déduire d'`__DEV__` aurait annoncé `prod` sur toute
     * diffusion interne, donc fabriqué cet incident à chaque fois.
     *
     * ABSENTES, ON POSE `null` PLUTÔT QUE D'ÉCHOUER, comme au-dessus : un poste
     * qui n'a pas les variables doit construire et démarrer normalement. En
     * phase 1 rien ne refuse ; le jour où la garde s'allume, un build sans paire
     * est un build mal configuré, et c'est au serveur de le dire. */
    clientId: process.env.LEHNO_CLIENT_ID ?? null,
    clientKey: process.env.LEHNO_CLIENT_KEY ?? null,
    appEnv: process.env.LEHNO_APP_ENV ?? null,
  },
});

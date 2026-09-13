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
/* LA PAIRE SUIT LA PLATEFORME, et les variables EAS ne le font pas toutes
 * seules : elles valent par ENVIRONNEMENT — `production`, `preview`,
 * `development` — jamais par plateforme. Une seule `LEHNO_CLIENT_ID` en
 * production donnerait donc la paire Android à un build iOS, et le serveur
 * verrait un `mobile_ios` présentant une paire enregistrée `mobile_android` :
 * c'est exactement `type_discordant`, et tous les iPhone seraient refusés le
 * jour où la garde s'allume.
 *
 * UNE PAIRE ABSENTE VAUT MIEUX QU'UNE PAIRE FAUSSE. Sans suffixe pour sa
 * plateforme, un build part non identifié — ce que la phase 1 tolère et que le
 * journal montre. Avec la paire de l'autre plateforme, il MENT sur ce qu'il
 * est, et c'est l'incident que tout ce dispositif cherche à détecter.
 *
 * `EAS_BUILD_PLATFORM` est posé par EAS pendant la construction. Hors EAS il
 * est absent, et on lit alors les noms nus — ceux du `.env.local` d'un poste
 * de développement. Aucun repli des noms suffixés vers les noms nus : ce repli
 * est précisément par où la paire de l'autre plateforme reviendrait. */
const plateforme = process.env.EAS_BUILD_PLATFORM;

const paire = (nom) =>
  plateforme === undefined
    ? process.env[nom] ?? null
    : process.env[`${nom}_${plateforme.toUpperCase()}`] ?? null;

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
    clientId: paire("LEHNO_CLIENT_ID"),
    clientKey: paire("LEHNO_CLIENT_KEY"),
    appEnv: process.env.LEHNO_APP_ENV ?? null,
  },
});

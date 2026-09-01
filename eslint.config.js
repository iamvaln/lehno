import lehnolint, { adherence } from "@lehno/eslint-config";

export default [
  // specs/ porte les prototypes du designer et les paquets de passation : du
  // code d'illustration, écrit ailleurs, qu'on lit sans le maintenir. Le linter
  // n'a rien à y dire, et ses avis y masqueraient les nôtres.
  //
  // .worktrees/ porte les copies de travail des branches en cours : les mêmes
  // fichiers y seraient examinés plusieurs fois, et chaque défaut compté autant
  // de fois qu'il existe de worktrees.
  { ignores: ["specs/**", ".worktrees/**"] },
  ...lehnolint,
  // Les règles d'adhérence (couleurs, ombres, durées en dur) visent les surfaces
  // qui rendent : les composants et pages du web, et ceux du back-office. Pas
  // les tests, pas les paquets partagés — packages/tokens a besoin de ses
  // hexadécimaux, c'est sa raison d'être — et pas le serveur.
  ...adherence.map((config) => ({
    ...config,
    files: [
      "apps/web/components/**", "apps/web/app/**", "apps/admin/src/**",
      // Le natif aussi : la règle y attrape ce qui compte — hexadécimal en dur,
      // rgb(), noms de couleurs, rayon numérique littéral. Sa partie var(--…)
      // ne s'y déclenche simplement jamais, React Native ne résolvant pas var().
      "apps/mobile/app/**", "apps/mobile/components/**", "packages/ui-native/src/**",
    ],
  })),

  // Les deux fichiers de configuration d'Expo sont lus par Metro et par Babel,
  // pas par l'application : ils sont en CommonJS, avec les globales de Node.
  // Les convertir en ESM n'est pas une option — Metro les charge par require.
  {
    files: [
      "apps/mobile/babel.config.js",
      "apps/mobile/metro.config.js",
      /* `app.config.js` s'exécute sur la MACHINE QUI CONSTRUIT, pas sur le
         téléphone : c'est ce qui lui permet de lire `process.env` et donc
         `ONESIGNAL_APP_ID` sans qu'on ait à la dupliquer sous un nom
         `EXPO_PUBLIC_`. Expo le charge par `require`, comme les deux autres. */
      "apps/mobile/app.config.js",
    ],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        module: "writable", require: "readonly", __dirname: "readonly",
        process: "readonly",
      },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // La table des polices doit employer require() : Metro empaquette un fichier
  // en analysant les require() du code source, donc un import dynamique ou un
  // chemin construit à l'exécution ne serait jamais embarqué. C'est la seule
  // exception du dépôt, et elle tient à l'empaqueteur, pas au style.
  {
    files: ["apps/mobile/polices/index.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

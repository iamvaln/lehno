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
    files: ["apps/web/components/**", "apps/web/app/**", "apps/admin/src/**"],
  })),
];

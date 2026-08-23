import lehnolint, { adherence } from "@lehno/eslint-config";

export default [
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

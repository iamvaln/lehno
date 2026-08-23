import lehnolint, { adherence } from "@lehno/eslint-config";

export default [
  ...lehnolint,
  // Les règles d'adhérence (couleurs, ombres, durées en dur) ne visent que les
  // composants et pages du web. Pas les tests, pas les paquets partagés —
  // packages/tokens a besoin de ses hexadécimaux, c'est sa raison d'être —
  // et pas le serveur.
  ...adherence.map((config) => ({
    ...config,
    files: ["apps/web/components/**", "apps/web/app/**"],
    // Ces fichiers datent d'avant le socle de design ; la tâche 9 les réécrit et
    // retire cette liste. Tout composant neuf est couvert dès sa création.
    ignores: [
      "apps/web/components/ApercuApplication.tsx",
      "apps/web/components/ApercuMur.tsx",
      "apps/web/components/BasculeLangue.tsx",
      "apps/web/components/BasculeTheme.tsx",
      "apps/web/components/Cloture.tsx",
      "apps/web/components/Contenu.tsx",
      "apps/web/components/Entete.tsx",
      "apps/web/components/Etapes.tsx",
      "apps/web/components/FormulaireAttente.tsx",
      "apps/web/components/Hero.tsx",
      "apps/web/components/Marque.tsx",
      "apps/web/components/Mur.tsx",
      "apps/web/components/Pied.tsx",
      "apps/web/components/Prix.tsx",
      "apps/web/components/Telephone.tsx",
    ],
  })),
];

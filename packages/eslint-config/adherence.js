// Trois règles du système de design qui n'étaient que des phrases dans un
// document : aucune couleur en dur, aucune ombre hors --shadow-device, aucune
// durée en dur — et une quatrième, plus subtile : aucune primitive employée
// directement (`var(--lehno-violet)`), qui nomme une couleur au lieu d'une
// intention. Un composant qui les enfreint fonctionne parfaitement à l'œil ;
// c'est justement pour ça qu'une phrase ne suffit pas à les faire respecter.

const PROPRIETES_DE_STYLE = new Set([
  "color", "background", "backgroundColor", "borderColor", "border",
  "boxShadow", "transition", "animation", "animationDuration",
  "transitionDuration", "borderRadius", "fill", "stroke",
]);

const HEXADECIMAL = /#[0-9a-fA-F]{3,8}\b/;
const PRIMITIVE = /var\(--lehno-/;
const DUREE = /\b\d+m?s\b/;
const OMBRE_ADMISE = "var(--shadow-device)";

const regle = {
  meta: { type: "problem", docs: { description: "n'employer que les jetons du système de design" } },
  create(context) {
    const signaler = (node, message) => context.report({ node, message });
    return {
      Property(node) {
        const cle = node.key.name ?? node.key.value;
        if (!PROPRIETES_DE_STYLE.has(cle)) return;
        if (node.value.type !== "Literal" || typeof node.value.value !== "string") return;
        const valeur = node.value.value;

        if (HEXADECIMAL.test(valeur))
          signaler(node, `Couleur écrite en dur : employez un jeton sémantique, par exemple var(--text-body).`);
        else if (PRIMITIVE.test(valeur))
          signaler(node, `Primitive employée directement : elle nomme une couleur, pas une intention. Passez par un alias sémantique.`);
        else if (cle === "boxShadow" && valeur !== OMBRE_ADMISE && valeur !== "none")
          signaler(node, `Aucune ombre dans ce produit : la profondeur vient des filets. Seul var(--shadow-device) est admis.`);
        else if (DUREE.test(valeur) && !valeur.includes("var(--duration"))
          signaler(node, `Durée écrite en dur : elle échappe à prefers-reduced-motion. Employez var(--duration-state), --duration-enter ou --duration-screen.`);
      },
    };
  },
};

export const adherence = [
  {
    // Le Linter de base (celui du test unitaire, et celui qu'ESLint applique
    // par défaut sans parser dédié) ne reconnaît le JSX que si on le demande :
    // sans cela, `<div style={{...}} />` échoue à l'analyse syntaxique.
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { lehno: { rules: { "jetons-seulement": regle } } },
    rules: { "lehno/jetons-seulement": "error" },
  },
];

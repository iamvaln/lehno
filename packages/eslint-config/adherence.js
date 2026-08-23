// Quatre règles du système de design qui n'étaient que des phrases dans un
// document : aucune couleur en dur, aucune ombre hors --shadow-device, aucune
// durée en dur, aucun rayon en dur — et une cinquième, plus subtile : aucune
// variable CSS qui ne soit pas réellement émise par le système de design
// (`var(--lehno-violet)`, un nom périmé comme `var(--violet)`, une faute de
// frappe…). Un composant qui les enfreint fonctionne parfaitement à l'œil ;
// c'est justement pour ça qu'une phrase ne suffit pas à les faire respecter.
//
// La liste blanche des variables admises n'est pas recopiée à la main : elle
// est dérivée, au chargement de ce module, de ce que `@lehno/tokens` émet
// réellement. Elle se met donc à jour toute seule quand les jetons changent,
// et elle attrape d'un coup les primitives, les noms périmés et les fautes de
// frappe — tout ce qui n'est pas dans l'ensemble est une erreur.
//
// `@lehno/tokens` est écrit en TypeScript et n'est jamais compilé à part :
// Next et Vitest le transpilent à la volée. ESLint, lui, charge sa
// configuration avec le Node nu, qui ne sait pas lire du TypeScript. jiti
// (déjà présent dans l'arbre des dépendances via typescript-eslint) comble
// cet écart : il transpile l'import à la demande, une seule fois, ici.
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const jetons = await jiti.import("@lehno/tokens");

const NOMS_EMIS = new Set(
  [...(jetons.cssVariables("light") + "\n" + jetons.cssTokens()).matchAll(/^\s*--([a-zA-Z0-9-]+)\s*:/gm)]
    .map((m) => m[1]),
);

const PROPRIETES_DE_STYLE = new Set([
  "color", "background", "backgroundColor", "borderColor", "border",
  "boxShadow", "transition", "animation", "animationDuration",
  "transitionDuration", "borderRadius", "fill", "stroke",
]);

// Hexadécimal, fonctions rgb()/hsl() et leurs variantes alpha, et un noyau de
// couleurs nommées CSS : au-delà de ce noyau, la liste est infinie, mais ces
// sept-là suffisent à couvrir les fautes réelles du dépôt.
const HEXADECIMAL = /#[0-9a-fA-F]{3,8}\b/;
const FONCTION_COULEUR = /\b(rgb|rgba|hsl|hsla)\(/i;
const NOM_COULEUR = /\b(white|black|red|green|blue|grey|gray)\b/i;
const VAR_USAGE = /var\(--([a-zA-Z0-9-]+)\)/g;
const DUREE = /\b\d+m?s\b/;
const OMBRE_ADMISE = "var(--shadow-device)";

function couleurEnDurDansTexte(texte) {
  return HEXADECIMAL.test(texte) || FONCTION_COULEUR.test(texte) || NOM_COULEUR.test(texte);
}

// Récupère le texte à examiner pour une valeur de propriété de style : une
// chaîne littérale telle quelle, ou le texte brut d'un littéral gabarit (les
// `${...}` interpolés n'apportent rien à la détection, on les ignore). Toute
// autre forme (nombre, hors du cas du rayon, identifiant, etc.) n'est pas
// examinée ici.
function valeurTextuelle(valueNode) {
  if (valueNode.type === "Literal" && typeof valueNode.value === "string") return valueNode.value;
  if (valueNode.type === "TemplateLiteral") return valueNode.quasis.map((q) => q.value.raw).join("");
  return null;
}

function nomsVarNonEmis(texte) {
  return [...texte.matchAll(VAR_USAGE)].map((m) => m[1]).filter((nom) => !NOMS_EMIS.has(nom));
}

const regle = {
  meta: { type: "problem", docs: { description: "n'employer que les jetons du système de design" } },
  create(context) {
    const signaler = (node, message) => context.report({ node, message });

    const examinerValeur = (node, cle, valeur) => {
      if (couleurEnDurDansTexte(valeur)) {
        signaler(node, `Couleur écrite en dur : employez un jeton sémantique, par exemple var(--text-body).`);
        return;
      }

      const nonEmis = nomsVarNonEmis(valeur);
      if (nonEmis.length > 0) {
        signaler(
          node,
          `La variable --${nonEmis[0]} n'est pas émise par le système de design (aucune primitive, aucun nom périmé) : passez par un rôle sémantique ou un jeton réellement exposé.`,
        );
        return;
      }

      if (cle === "boxShadow" && valeur !== OMBRE_ADMISE && valeur !== "none") {
        signaler(node, `Aucune ombre dans ce produit : la profondeur vient des filets. Seul var(--shadow-device) est admis.`);
        return;
      }

      if (DUREE.test(valeur) && !valeur.includes("var(--duration"))
        signaler(node, `Durée écrite en dur : elle échappe à prefers-reduced-motion. Employez var(--duration-state), --duration-enter ou --duration-screen.`);
    };

    return {
      Property(node) {
        const cle = node.key.name ?? node.key.value;
        if (!PROPRIETES_DE_STYLE.has(cle)) return;

        // Rayon numérique : `borderRadius: 14` échappe entièrement à la
        // détection textuelle ci-dessous, car ce n'est pas une chaîne. 0 reste
        // admis : c'est l'absence de rayon, pas une valeur en dur.
        if (cle === "borderRadius" && node.value.type === "Literal" && typeof node.value.value === "number") {
          if (node.value.value !== 0)
            signaler(node, `Rayon écrit en dur : composez avec un jeton --radius-*, par exemple var(--radius-lg).`);
          return;
        }

        const valeur = valeurTextuelle(node.value);
        if (valeur === null) return;
        examinerValeur(node, cle, valeur);
      },

      // Les drapeaux et autres glyphes SVG posent leur couleur directement en
      // attribut JSX (`fill="#012169"`), hors de tout `style={{ ... }}` : un
      // visiteur Property seul ne les voit jamais.
      JSXAttribute(node) {
        const nom = node.name.name;
        if (nom !== "fill" && nom !== "stroke") return;
        if (!node.value) return;

        let valeur = null;
        if (node.value.type === "Literal" && typeof node.value.value === "string") {
          valeur = node.value.value;
        } else if (node.value.type === "JSXExpressionContainer") {
          const expr = node.value.expression;
          if (expr.type === "Literal" && typeof expr.value === "string") valeur = expr.value;
          else if (expr.type === "TemplateLiteral") valeur = expr.quasis.map((q) => q.value.raw).join("");
        }
        if (valeur === null) return;
        examinerValeur(node, nom, valeur);
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

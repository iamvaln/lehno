// Metro dans un monorepo pnpm. Deux réglages, et aucun n'est optionnel :
// Metro ne surveille que le dossier du projet par défaut, donc il ne verrait
// pas packages/tokens changer ; et pnpm range les dépendances en lien
// symbolique sous le node_modules de la racine, que Metro doit connaître.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projet = __dirname;
const racine = path.resolve(projet, "../..");

const config = getDefaultConfig(projet);
config.watchFolders = [racine];
config.resolver.nodeModulesPaths = [
  path.resolve(projet, "node_modules"),
  path.resolve(racine, "node_modules"),
];
// Pas de disableHierarchicalLookup ici, contrairement à ce que recommandent les
// guides écrits pour Yarn : sous pnpm, la remontée de la chaîne node_modules est
// justement ce qui résout les dépendances privées d'un paquet, rangées sous
// .pnpm/. La couper fait échouer la résolution dès la première transitive.
// Le doublon de React qu'elle prévient n'a pas lieu d'être : le dépôt n'en
// installe qu'une version, et pnpm ne la duplique pas.

// Metro lit bien la carte « exports » des paquets — c'est déjà son défaut — mais
// il arrive ici sans aucun nom de condition, et ne peut donc choisir aucune de
// ses branches : « ./icons/* » ne résout alors vers rien. Les nommer rend
// l'entrée profonde possible, seul moyen de ne pas embarquer les mille cinq
// cents icônes que personne n'affiche, Metro n'élaguant pas.
config.resolver.unstable_conditionNames = ["react-native", "import", "require"];

// Les paquets partagés suffixent leurs imports relatifs en « .js », comme le
// veut l'ESM de Node dont l'API dépend — alors que les fichiers sont des « .ts ».
// TypeScript le sait (moduleResolution: Bundler) ; Metro résout littéralement et
// ne trouve rien. Plutôt que d'imposer au dépôt entier une convention d'import
// dictée par l'empaqueteur mobile, on apprend la correspondance à Metro.
const resolutionParDefaut = config.resolver.resolveRequest;

config.resolver.resolveRequest = (contexte, nom, plateforme) => {
  if (nom.startsWith(".") && nom.endsWith(".js")) {
    for (const extension of [".ts", ".tsx"]) {
      try {
        return contexte.resolveRequest(contexte, nom.replace(/\.js$/, extension), plateforme);
      } catch {
        // Le fichier .js existe peut-être vraiment : on laisse la suite trancher.
      }
    }
  }
  return (resolutionParDefaut ?? contexte.resolveRequest)(contexte, nom, plateforme);
};

module.exports = config;

// Les quatre primitives du produit, copiées depuis apps/web/components/ui.
// Douze des dix-neuf composants d'administration dépendent d'Icon, trois de
// Button : c'est le tronc, et il ne se réécrit pas — un test vérifie que ces
// fichiers restent identiques à ceux du produit, pour que la duplication soit
// une dette visible plutôt qu'une divergence silencieuse.
export { Icon, type IconProps } from "./Icon.js";
export { Button, type ButtonProps } from "./Button.js";
export { BrandMark, type VariantePastille } from "./BrandMark.js";
export { TextField } from "./TextField.js";

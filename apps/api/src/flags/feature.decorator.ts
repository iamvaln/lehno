import { SetMetadata, type CustomDecorator } from "@nestjs/common";
import type { CleDrapeau } from "@lehno/contracts";

export const FEATURE_KEY = "feature";

// La clé est typée CleDrapeau, pas string : c'est tout l'intérêt du
// registre. Une faute de frappe devient une erreur de compilation, pas une
// surface éteinte en silence dont personne ne s'aperçoit.
export const Feature = (cle: CleDrapeau): CustomDecorator<string> => SetMetadata(FEATURE_KEY, cle);

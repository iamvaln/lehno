import { ICONES, type NomDIcone } from "./Icon.icons.js";
import { epaisseurDuTrait } from "./Icon.styles.js";
import { useCouleurs } from "../ThemeProvider.js";

/* Enveloppe Lucide — la même bibliothèque et les mêmes noms que sur le web.
   Le rendu passe par ICONES : aucun accès dynamique à la bibliothèque, sinon
   l'empaqueteur la réembarquerait entière. */

export interface IconProps {
  name: string;
  size?: number;
  color?: string | undefined;
  strokeWidth?: number | undefined;
}

export function Icon({ name, size = 20, color, strokeWidth }: IconProps) {
  const couleurs = useCouleurs();
  const Dessin = ICONES[name as NomDIcone];
  // Un nom absent du tableau ne rend rien plutôt que de faire tomber l'écran :
  // une icône manquante est un défaut de charte, pas une raison d'interrompre
  // une lecture. C'est le test des icônes qui l'attrape, pas l'utilisateur.
  if (!Dessin) return null;
  // Sans couleur donnée, l'icône prend celle du texte courant — ce que le web
  // obtenait par currentColor, notion que React Native n'a pas.
  return (
    <Dessin
      size={size}
      color={color ?? couleurs.textBody}
      strokeWidth={epaisseurDuTrait(name, size, strokeWidth)}
    />
  );
}

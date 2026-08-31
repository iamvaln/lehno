import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Icon } from "./Icon.js";
import { styleDuBouton, type RangDeBouton } from "./Button.styles.js";

/* Le JSX ne décide rien : Button.styles.ts porte les rangs, la cible tactile,
   la bordure et la couleur de l'icône. Ici il ne reste qu'à les appliquer. */

/* Sous `exactOptionalPropertyTypes`, une prop déclarée « ?: T » refuse qu'on
   lui passe explicitement `undefined` — ce que fait pourtant tout composant qui
   transmet la sienne. Les props transmises portent donc « | undefined ». */
export interface ButtonProps {
  children: ReactNode;
  variant?: RangDeBouton;
  full?: boolean;
  disabled?: boolean;
  icon?: string | undefined;
  iconAfter?: string | undefined;
  onPress?: (() => void) | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}

export function Button({
  children, variant = "primary", full = false, disabled = false,
  icon, iconAfter, onPress, style,
}: ButtonProps) {
  const couleurs = useCouleurs();

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      // Le doigt touche plus large que le dessin : la zone touchable s'élargit
      // sans que le bouton grossisse.
      hitSlop={8}
      style={({ pressed }) => [
        styleDuBouton({ couleurs, rang: variant, presse: pressed, desactive: disabled, pleineLargeur: full }).conteneur,
        style,
      ]}
    >
      {({ pressed }: { pressed: boolean }) => {
        const s = styleDuBouton({ couleurs, rang: variant, presse: pressed, desactive: disabled, pleineLargeur: full });
        return (
          <>
            {icon ? <Icon name={icon} size={s.tailleIcone} color={s.couleurIcone} /> : null}
            <Text style={s.libelle}>{children}</Text>
            {iconAfter ? <Icon name={iconAfter} size={s.tailleIcone} color={s.couleurIcone} /> : null}
          </>
        );
      }}
    </Pressable>
  );
}

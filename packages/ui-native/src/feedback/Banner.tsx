import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Icon } from "../core/Icon.js";
import { styleDeBandeau, type Intention } from "./Banner.styles.js";

export interface BannerProps {
  children: ReactNode;
  intent?: Intention | undefined;
  // Le libellé du bouton de fermeture vient du dictionnaire : le design system
  // posait un aria-label « Fermer » qui restait français en anglais.
  dismissLabel?: string | undefined;
  onDismiss?: (() => void) | undefined;
}

export function Banner({ children, intent = "info", dismissLabel, onDismiss }: BannerProps) {
  const couleurs = useCouleurs();
  const s = styleDeBandeau({ couleurs, intention: intent });

  return (
    <View
      style={s.conteneur}
      accessibilityRole={intent === "error" ? "alert" : "text"}
      /* Android relit la zone quand elle change ; iOS ne connaît pas cette
         propriété et l'ignore. L'écran qui a besoin d'être entendu à coup sûr
         sur les deux systèmes doit annoncer lui-même. */
      accessibilityLiveRegion={s.urgence}
    >
      <Icon name={s.icone} size={17} color={s.couleurIcone} />
      <Text style={s.texte}>{children}</Text>
      {onDismiss ? (
        <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel={dismissLabel} hitSlop={10}>
          <Icon name="x" size={15} color={s.couleurIcone} />
        </Pressable>
      ) : null}
    </View>
  );
}

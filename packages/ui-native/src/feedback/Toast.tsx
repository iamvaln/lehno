import { useEffect, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Icon } from "../core/Icon.js";
import { delaiDEffacement, styleDAccuse, type IntentionDAccuse } from "./Toast.styles.js";

export interface ToastProps {
  children: ReactNode;
  intent?: IntentionDAccuse | undefined;
  /** La sortie qu'offre l'accusé : « Annuler », « Voir le compte ». */
  action?: string | undefined;
  onAction?: (() => void) | undefined;
  /** Sans onDismiss, l'accusé ne s'efface pas seul : à réserver aux erreurs. */
  onDismiss?: (() => void) | undefined;
  /** Millisecondes avant effacement. 0 le fige. */
  duration?: number | undefined;
  // Le libellé de la fermeture vient du dictionnaire : le design system posait
  // un « Fermer » qui restait français en anglais.
  dismissLabel?: string | undefined;
  /** Le creux du bas de l'écran — barre d'accueil, barre d'onglets, ou rien. */
  insetBas?: number | undefined;
}

/* L'accusé se pose en absolu au bas de son parent : `position: fixed` n'existe
   pas en natif, donc c'est l'écran qui le monte au bon niveau — sinon il se
   collerait au bas de la liste qu'il accuse, et défilerait avec elle. */
export function Toast({
  children, intent = "success", action, onAction, onDismiss, duration, dismissLabel, insetBas,
}: ToastProps) {
  const couleurs = useCouleurs();
  const s = styleDAccuse({ couleurs, intention: intent, ...(insetBas !== undefined ? { insetBas } : {}) });
  const delai = delaiDEffacement({
    ...(duration !== undefined ? { duree: duration } : {}),
    effacable: onDismiss != null,
  });

  useEffect(() => {
    if (delai == null || !onDismiss) return;
    const h = setTimeout(onDismiss, delai);
    return () => clearTimeout(h);
    // `children` entre dans les dépendances : un accusé dont le texte change
    // est un nouvel accusé, et il repart pour son plein délai.
  }, [delai, onDismiss, children]);

  return (
    <View
      style={s.conteneur}
      accessibilityRole={intent === "error" ? "alert" : "text"}
      /* Android relit la zone quand elle paraît ; iOS ignore la propriété.
         L'écran qui doit être entendu à coup sûr annonce lui-même. */
      accessibilityLiveRegion={s.urgence}
    >
      <Icon name={s.signe} size={s.tailleSigne} color={s.couleurSigne} />
      <Text style={s.texte}>{children}</Text>
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={s.commande}>
          <Text style={s.action}>{action}</Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          style={s.fermeture}
        >
          <Icon name="x" size={s.tailleFermeture} color={s.couleurEncre} />
        </Pressable>
      ) : null}
    </View>
  );
}

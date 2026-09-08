import { Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Button } from "../core/Button.js";
import { Icon } from "../core/Icon.js";
import { Illustration } from "../brand/Illustration.js";
import { ornementDeVide, styleDEtatVide } from "./EmptyState.styles.js";

export interface EmptyStateProps {
  title: string;
  text?: string | undefined;
  illustration?: string | undefined;
  icon?: string | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}

export function EmptyState({ title, text, illustration, icon, actionLabel, onAction }: EmptyStateProps) {
  const couleurs = useCouleurs();
  const s = styleDEtatVide(couleurs);
  const ornement = ornementDeVide({ illustration, icone: icon });

  return (
    <View style={s.conteneur}>
      {/* Un ornement, pas deux : l'illustration l'emporte quand elle existe,
          l'icône ne fait que signaler le vide là où aucune n'est prévue.
          `Illustration` a longtemps manqué — la branche restait vide, et les
          états vides se sont affichés sans rien pendant tout ce temps. */}
      {ornement?.sorte === "illustration" ? (
        <Illustration name={ornement.nom} width={150} />
      ) : ornement?.sorte === "icone" ? (
        <Icon name={ornement.nom} size={28} color={s.couleurIcone} />
      ) : null}
      <Text style={s.titre} accessibilityRole="header">{title}</Text>
      {text ? <Text style={s.texte}>{text}</Text> : null}
      {actionLabel ? (
        /* `alignSelf: "center"` EN PLUS du centrage du conteneur, et il le faut.
           Le bouton pose lui-même `alignSelf: "flex-start"` quand il n'est pas
           en pleine largeur — pour ne pas s'étirer dans une colonne — et
           `alignSelf` l'emporte toujours sur le `alignItems` du parent. Le
           bouton se retrouvait donc collé à gauche sous un titre et un texte
           centrés, sur TOUS les états vides de l'application. */
        <Button
          variant="primary"
          onPress={onAction}
          style={{ marginTop: 20, alignSelf: "center" }}
        >{actionLabel}</Button>
      ) : null}
    </View>
  );
}

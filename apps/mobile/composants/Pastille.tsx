import { Pressable, StyleSheet, Text, type LayoutChangeEvent } from "react-native";
import { nativeBorder, nativeFont, nativeRadius, nativeSpace } from "@lehno/tokens";
import { Icon, useCouleurs } from "@lehno/ui-native";

/* UN CHOIX PARMI PLUSIEURS, en une pastille.
 *
 * Elle était définie TROIS FOIS — dans `note.tsx`, `evenement.tsx` et
 * l'identité — avec des noms de props différents (`onPress` là, `appuie` ici)
 * et des styles recopiés. Trois dessins pour un même geste finissent par
 * diverger : c'est déjà arrivé sur la cible tactile, que l'une des trois avait
 * laissée sous les 44 points de la charte.
 */
export function Pastille({ actif, libelle, icone, appuie, surLaMise }: {
  actif: boolean;
  libelle: string;
  icone?: string | undefined;
  appuie: () => void;
  /* Où la pastille s'est posée. Sert à porter une rangée qui défile sur celle
     qui est choisie : sa largeur dépend du texte et des jetons, donc on la
     MESURE plutôt que de la calculer. */
  surLaMise?: ((x: number, largeur: number) => void) | undefined;
}) {
  const couleurs = useCouleurs();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      onPress={appuie}
      {...(surLaMise
        ? { onLayout: (e: LayoutChangeEvent) => {
            surLaMise(e.nativeEvent.layout.x, e.nativeEvent.layout.width);
          } }
        : {})}
      style={[styles.pastille, {
        borderColor: actif ? "transparent" : couleurs.borderObject,
        backgroundColor: actif ? couleurs.action : "transparent",
      }]}
    >
      {icone ? (
        <Icon name={icone} size={16} color={actif ? couleurs.textOnAccent : couleurs.textSecondary} />
      ) : null}
      <Text style={[styles.pastilleTexte, {
        color: actif ? couleurs.textOnAccent : couleurs.textSecondary,
      }]}>{libelle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pastille: {
    minHeight: 38, minWidth: 38, paddingHorizontal: nativeSpace[14],
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: nativeSpace[6],
    borderRadius: nativeRadius.pill, borderWidth: nativeBorder.width,
  },
  pastilleTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 13 },
});

import { Pressable, StyleSheet, Text, View } from "react-native";
import { nativeBorder, nativeFont, nativeRadius, nativeSpace } from "@lehno/tokens";
import { useCouleurs } from "@lehno/ui-native";

/* Un choix unique en pastilles. Pas de liste déroulante : trois à sept valeurs
   se lisent d'un coup, et un sélecteur natif cacherait le choix derrière un
   geste de plus. Réappuyer sur la pastille active la retire — un lien choisi
   par erreur doit pouvoir se défaire sans vider le formulaire.

   PARTAGÉ, et pas recopié. Il vivait dans l'écran d'identité d'un proche ; le
   profil pose la même question sur soi. Deux copies auraient divergé à la
   première retouche — et c'est le genre d'écart qu'on ne voit qu'à l'écran,
   un formulaire par un côté et pas par l'autre.

   Il n'est PAS dans `@lehno/ui-native` : le kit ne le décrit pas parmi ses
   primitives, et le faire entrer dans le système de dessin sans planche
   engagerait les autres surfaces sur une forme que personne n'a arrêtée. */
export function Choix<T extends string>({ options, libelle, valeur, pose }: {
  options: readonly T[];
  libelle: (valeur: T) => string;
  valeur: T | null;
  pose: (valeur: T | null) => void;
}) {
  const couleurs = useCouleurs();
  return (
    <View style={styles.pastilles}>
      {options.map((o) => {
        const actif = valeur === o;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityState={{ selected: actif }}
            onPress={() => pose(actif ? null : o)}
            style={[styles.pastille, {
              borderColor: actif ? "transparent" : couleurs.borderObject,
              backgroundColor: actif ? couleurs.action : "transparent",
            }]}
          >
            <Text style={[styles.pastilleTexte, {
              color: actif ? couleurs.textOnAccent : couleurs.textSecondary,
            }]}>{libelle(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pastilles: { flexDirection: "row", flexWrap: "wrap", gap: nativeSpace[6], marginTop: nativeSpace[8] },
  pastille: {
    minHeight: 38, paddingHorizontal: nativeSpace[14], justifyContent: "center",
    borderRadius: nativeRadius.pill, borderWidth: nativeBorder.width,
  },
  pastilleTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 13 },
});

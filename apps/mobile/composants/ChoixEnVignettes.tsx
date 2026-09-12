import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { StudioChoice } from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeRadius, nativeSpace } from "@lehno/tokens";
import { useCouleurs } from "@lehno/ui-native";

/* CE QU'ON REGARDE EST CE QU'ON AURA.
 *
 * « Un choix de rendu ne se fait pas avec des mots : personne ne sait
 * départager "chaleureux" et "sobre" dans l'abstrait. » D'où la grille, là où
 * les pastilles de `Choix` suffisent partout ailleurs.
 *
 * DEUX COLONNES, ET PAS TROIS : une vignette de rendu trop petite ne départage
 * plus rien, et c'est précisément ce qu'elle est là pour faire.
 *
 * L'IMAGE PEUT MANQUER, et alors la case reste une case : le cadre garde sa
 * place et son rapport, sinon la grille se déforme d'une ligne à l'autre selon
 * ce que l'administration a publié. `laGrilleMontreDesImages` décide en amont
 * s'il vaut seulement la peine d'afficher une grille.
 *
 * L'URL EST SIGNÉE ET EXPIRE — le contrat l'écrit : « la ranger donnerait des
 * liens morts, les nôtres expirent, c'est le propos ». Ce composant la reçoit
 * donc en propriété, à chaque rendu, et ne la garde nulle part. */
export function ChoixEnVignettes({ choix, valeur, pose }: {
  choix: readonly StudioChoice[];
  valeur: string | null;
  pose: (id: string) => void;
}) {
  const couleurs = useCouleurs();
  return (
    <View style={styles.grille}>
      {choix.map((c) => {
        const actif = valeur === c.id;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: actif, checked: actif }}
            /* LE LECTEUR D'ÉCRAN N'A PAS LA VIGNETTE. Sans la description, il
               n'entendrait que le libellé, c'est-à-dire la moitié de ce que
               voit quelqu'un qui regarde la grille. */
            accessibilityLabel={c.description === null ? c.label : `${c.label}. ${c.description}`}
            onPress={() => pose(c.id)}
            style={[styles.case, {
              borderWidth: actif ? nativeBorder.widthFirm : nativeBorder.width,
              borderColor: actif ? couleurs.action : couleurs.borderObject,
            }]}
          >
            <View style={[styles.cadre, { backgroundColor: couleurs.surfacePanel }]}>
              {c.previewUrl === null ? null : (
                <Image source={{ uri: c.previewUrl }} style={styles.image} resizeMode="cover" />
              )}
            </View>
            <Text style={[styles.titre, { color: couleurs.textBody }]}>{c.label}</Text>
            {c.description === null ? null : (
              <Text style={[styles.aide, { color: couleurs.textMention }]}>{c.description}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grille: { flexDirection: "row", flexWrap: "wrap", gap: nativeSpace[12], marginTop: nativeSpace[8] },
  /* La largeur en pourcentage plutôt qu'en points : deux colonnes qui tiennent
     à toutes les largeurs, sans mesurer l'écran. */
  case: { width: "48%", borderRadius: nativeRadius.lg, padding: nativeSpace[8] },
  cadre: { width: "100%", aspectRatio: 1, borderRadius: nativeRadius.md, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  /* `nativeFont` porte des NOMS DE POLICES, pas des tailles — la taille s'écrit
     en nombre, comme dans `Choix.tsx` juste à côté. */
  titre: { fontFamily: nativeFont.bodySemibold, fontSize: 14, marginTop: nativeSpace[8] },
  aide: { fontFamily: nativeFont.bodyRegular, fontSize: 12, marginTop: nativeSpace[4] },
});

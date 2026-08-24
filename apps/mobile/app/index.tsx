import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { nativeFont, nativeLeading, nativeLineHeight, nativeSize, nativeSpace } from "@lehno/tokens";
import { useTheme } from "@lehno/ui-native";

/* Écran de contrôle du socle — il ne survivra pas au lot 4, qui pose l'accueil.
 *
 * Il ne prouve qu'une chose, mais elle ne se prouve pas autrement qu'à l'œil :
 * que les huit instances cuites se chargent, que le thème suit le système, et
 * que les jetons dérivés rendent les mêmes valeurs que le web. Une police qui
 * ne se charge pas ne lève aucune erreur — elle rend en police système, et seul
 * un écran qui montre les deux familles côte à côte le fait voir. */

const ECHANTILLONS = [
  { police: nativeFont.displayMedium, taille: nativeSize.displayS, texte: "Bonjour, Valentine" },
  { police: nativeFont.displayRegular, taille: nativeSize.displayXs, texte: "J−12" },
  { police: nativeFont.displayItalic, taille: nativeSize.bodyL, texte: "« ce qu'on a partagé »" },
  { police: nativeFont.bodyRegular, taille: nativeSize.bodyM, texte: "Une date cette semaine." },
  { police: nativeFont.bodySemibold, taille: nativeSize.bodyS, texte: "Laisser une note" },
  { police: nativeFont.bodyBold, taille: nativeSize.bodyXs, texte: "Marquer envoyé" },
];

export default function Controle() {
  const { theme, couleurs } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + nativeSpace[24], paddingBottom: insets.bottom + nativeSpace[24] },
      ]}
    >
      <Text style={[styles.titre, { color: couleurs.textMention }]}>
        socle · thème {theme}
      </Text>

      {ECHANTILLONS.map((e) => (
        <Text
          key={e.police + e.texte}
          style={{
            fontFamily: e.police,
            fontSize: e.taille,
            lineHeight: nativeLineHeight(e.taille, nativeLeading.title),
            color: couleurs.textBody,
            marginBottom: nativeSpace[8],
          }}
        >
          {e.texte}
        </Text>
      ))}

      <View style={styles.nuancier}>
        {(["action", "celebrate", "feedbackError", "feedbackErrorPress"] as const).map((role) => (
          <View key={role} style={[styles.pastille, { backgroundColor: couleurs[role] }]} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: nativeSpace[16] },
  titre: {
    fontFamily: nativeFont.bodySemibold,
    fontSize: nativeSize.kicker,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: nativeSpace[16],
  },
  nuancier: { flexDirection: "row", gap: nativeSpace[8], marginTop: nativeSpace[16] },
  pastille: { width: nativeSpace[40], height: nativeSpace[40], borderRadius: nativeSpace[8] },
});

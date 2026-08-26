import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { nativeFont, nativeLetterSpacing, nativeRadius, nativeSpace, nativeTracking } from "@lehno/tokens";
import { Button, Illustration, useTheme } from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";

/* Le dernier écran du parcours : ce qu'on reçoit en arrivant, et une seule
   porte de sortie. « Inviter un ami » renvoie au parrainage — il n'existe pas
   encore, et le bouton mène pour l'instant à l'accueil plutôt qu'au vide. */
export default function Bienvenue() {
  const { t } = useLangue();
  const { couleurs } = useTheme();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  /* Les crédits viennent de la réponse d'inscription, pas d'une constante :
     le montant se règle en administration, et l'écrire en dur le ferait mentir
     au premier changement.

     Le nom aussi : c'est le pseudo qu'on vient de choisir. Il était laissé
     vide en attendant le profil, et l'écran saluait « Bienvenue, » — une
     virgule suivie de rien, qui se lit comme un défaut plutôt que comme un
     accueil. Le pseudo est là, deux écrans plus tôt ; il suffit de le porter. */
  const { pseudo, credits, bonus, parrain } = useLocalSearchParams<{
    pseudo: string; credits: string; bonus: string; parrain: string;
  }>();
  const offerts = Number(credits ?? 0);
  const gagnes = Number(bonus ?? 0);

  return (
    <View style={[styles.contenu, { paddingTop: insets.top + nativeSpace[32], paddingBottom: insets.bottom + nativeSpace[20] }]}>
      <Illustration name="bienvenue-credits" width={140} />

      <Text style={[styles.titre, { color: couleurs.textBody }]}>{t.bienvenueTitre(pseudo ?? "")}</Text>
      <Text style={[styles.texte, { color: couleurs.textSecondary }]}>{t.bienvenueTexte}</Text>

      <View style={[styles.cadeau, { backgroundColor: couleurs.surfacePanel }]}>
        <Text style={[styles.credits, { color: couleurs.textAccent }]}>{t.bienvenueCredits(offerts)}</Text>
        <Text style={[styles.cadeauTexte, { color: couleurs.textSecondary }]}>{t.bienvenueCadeau}</Text>
      </View>

      {/* Le parrainage ne paraît QUE s'il a joué. La ligne s'affichait toujours,
          libellé seul et sans montant : elle annonçait un bonus à qui n'en avait
          aucun. Le DÉTAIL, pas un total — c'est ce qui garde une raison
          d'inviter quelqu'un. */}
      {gagnes > 0 ? (
        <Text style={[styles.parrainage, { color: couleurs.textMention }]}>
          {t.bienvenueCredits(gagnes)} · {t.bienvenueParrainage}
          {parrain ? ` · ${parrain}` : ""}
        </Text>
      ) : null}

      <View style={styles.sorties}>
        <Button variant="primary" full onPress={() => routeur.replace("/")}>{t.commencer}</Button>
        <Button variant="text" full onPress={() => routeur.replace("/")}>{t.inviterAmi}</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenu: { flex: 1, alignItems: "center", paddingHorizontal: nativeSpace[24] },
  titre: {
    fontFamily: nativeFont.displayMedium, fontSize: 26, textAlign: "center",
    letterSpacing: nativeLetterSpacing(26, nativeTracking.title), marginTop: nativeSpace[20],
  },
  texte: {
    fontFamily: nativeFont.bodyRegular, fontSize: 14.5, textAlign: "center",
    lineHeight: 22, marginTop: nativeSpace[8],
  },
  cadeau: { alignSelf: "stretch", alignItems: "center", padding: nativeSpace[20], borderRadius: nativeRadius.xl, marginTop: nativeSpace[24] },
  credits: { fontFamily: nativeFont.displayMedium, fontSize: 28 },
  cadeauTexte: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, textAlign: "center", marginTop: nativeSpace[4] },
  parrainage: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, textAlign: "center", marginTop: nativeSpace[16], lineHeight: 18 },
  sorties: { alignSelf: "stretch", gap: nativeSpace[6], marginTop: "auto" },
});

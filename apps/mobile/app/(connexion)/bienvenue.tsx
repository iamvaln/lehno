import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  nativeBorder, nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin,
  nativeTracking,
} from "@lehno/tokens";
import { Button, Illustration, useTheme } from "@lehno/ui-native";
import { estActive } from "@lehno/contracts";
import { useLangue } from "../../lib/langue.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import {
  expliqueLeBonusManque, lignesDeBienvenue, phraseDeBienvenue,
} from "../../lib/bienvenue.js";

/* Le dernier écran du parcours : ce qu'on reçoit en arrivant, et une seule
   porte de sortie. « Inviter un ami » renvoie au parrainage — il n'existe pas
   encore, et le bouton mène pour l'instant à l'accueil plutôt qu'au vide. */
export default function Bienvenue() {
  const { t } = useLangue();
  const { actives } = useDrapeaux();
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
  const { pseudo, credits, attente, bonus, issueParrain } = useLocalSearchParams<{
    pseudo: string; credits: string; attente: string; bonus: string; issueParrain: string;
  }>();

  /* UNE LIGNE PAR GESTE, jamais un total. Le cadeau vient à tout le monde, la
     liste d'attente se méritait, le parrainage se mérite autrement — et le cas
     du lancement en porte deux : ceux qui recevront le courrier d'ouverture
     attendaient. */
  const lignes = lignesDeBienvenue({
    cadeau: Number(credits ?? 0),
    attente: Number(attente ?? 0),
    parrainage: issueParrain
      ? { outcome: issueParrain as "credited" | "unknown" | "self", bonusCredits: Number(bonus ?? 0) }
      : null,
  }, actives, t);
  /* Le bonus et l'invitation suivent le même drapeau : promettre un bonus
     puis ne pas offrir d'inviter serait une porte qui manque. */
  const parrainageOuvert = estActive(actives, "referral");

  return (
    <View style={[styles.contenu, { paddingTop: insets.top + nativeSpace[32], paddingBottom: insets.bottom + nativeSpace[20] }]}>
      <Illustration name="bienvenue-credits" width={140} />

      <Text style={[styles.titre, { color: couleurs.textBody }]}>{t.bienvenueTitre(pseudo ?? "")}</Text>
      {/* La phrase ÉNUMÈRE ce qui est ouvert. Elle disait le produit entier —
          « un portrait, des idées de cadeau, un mot juste » — quelle que soit la
          configuration : au lancement, elle promettait deux choses sur trois que
          personne ne pourrait faire. */}
      <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
        {phraseDeBienvenue(actives, t)}
      </Text>

      {lignes.map((ligne) => (
        <View
          key={ligne.cle}
          style={[styles.ligne, { borderTopColor: couleurs.borderHairline }]}
        >
          <Text style={[styles.ligneLibelle, { color: couleurs.textSecondary }]}>
            {ligne.libelle}
          </Text>
          <Text style={[styles.ligneValeur, {
            color: ligne.sourd ? couleurs.textMention
              : ligne.accent ? couleurs.textAccent : couleurs.textBody,
          }]}>{ligne.valeur}</Text>
        </View>
      ))}

      {/* La phrase n'accompagne QUE le bonus manqué. Pas de bandeau d'erreur
          pour un bonus qui n'arrive pas : alarmer quelqu'un sur un compte qui
          vient de se créer serait lui apprendre à s'inquiéter de ce qui a
          marché. */}
      {expliqueLeBonusManque(lignes) ? (
        <Text style={[styles.aide, { color: couleurs.textMention }]}>
          {t.bienvenueParrainageAide}
        </Text>
      ) : null}

      <View style={styles.sorties}>
        <Button variant="primary" full onPress={() => routeur.replace("/")}>{t.commencer}</Button>
        {parrainageOuvert ? (
          <Button variant="text" full onPress={() => routeur.replace("/")}>{t.inviterAmi}</Button>
        ) : null}
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
  /* Une ligne par geste : le libellé à gauche, la valeur à droite, un filet
     entre. La première porte le sien aussi — elle se détache de la phrase
     au-dessus, qui n'est pas du même ordre. */
  ligne: {
    alignSelf: "stretch", flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", gap: nativeSpace[12],
    minHeight: nativeTouchMin, paddingVertical: nativeSpace[8],
    borderTopWidth: nativeBorder.width,
  },
  ligneLibelle: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5, flexShrink: 1 },
  ligneValeur: { fontFamily: nativeFont.displayMedium, fontSize: 17 },
  aide: {
    alignSelf: "stretch", fontFamily: nativeFont.bodyRegular, fontSize: 12.5,
    lineHeight: 18, marginTop: nativeSpace[8],
  },
  sorties: { alignSelf: "stretch", gap: nativeSpace[6], marginTop: "auto" },
});

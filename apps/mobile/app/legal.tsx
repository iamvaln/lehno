import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LEGAL_DOCUMENTS, type LegalDocument } from "@lehno/contracts";
import {
  nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import { Banner, Button, Icon, LoadingState, useCouleurs } from "@lehno/ui-native";
import { useLangue } from "../lib/langue.js";
import { texteDunePagePublique, ErreurDApi } from "../lib/api.js";
import { messageDErreur } from "../lib/session.js";
import { cheminDuDocument } from "../lib/aide.js";
import { blocsDeMarkdown } from "../lib/markdown.js";

/* Un document légal — conditions, confidentialité, mentions.
 *
 * HORS DE `(app)`, et c'est le point. On accepte les conditions à l'écran de
 * CONNEXION, avant qu'aucune session n'existe : un document rangé derrière
 * l'authentification ne pourrait pas être lu au moment où on le signe. La route
 * est publique du serveur jusqu'ici.
 *
 * Ils étaient servis et personne ne les montrait : l'écran de connexion peignait
 * « conditions d'utilisation » en couleur d'accent, sans rien ouvrir. On faisait
 * accepter un texte qu'on ne donnait pas à lire.
 */
export default function Legal() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { document } = useLocalSearchParams<{ document?: string }>();

  const [texte, setTexte] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  /* Un document hors des trois n'est pas une erreur à afficher : c'est une
     navigation qui n'aurait pas dû partir. On ne demande rien au serveur pour
     s'entendre répondre 404. */
  const connu = (LEGAL_DOCUMENTS as readonly string[]).includes(document ?? "")
    ? (document as LegalDocument)
    : null;

  const charge = useCallback(async () => {
    if (!connu) return;
    try {
      setTexte(await texteDunePagePublique(cheminDuDocument(connu, langue)));
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [connu, langue]);

  useEffect(() => { void charge(); }, [charge]);

  /* UN DOCUMENT INCONNU N'EST PAS UN ÉTAT À DESSINER : c'est une navigation qui
     n'aurait pas dû partir, et il n'existe aucune phrase pour le dire. On
     ressort comme on est venu — même règle que l'écran de génération sans
     identifiant. */
  useEffect(() => {
    if (!connu) {
      if (routeur.canGoBack()) routeur.back();
      else routeur.replace("/");
    }
  }, [connu, routeur]);

  const retour = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.retour}
      onPress={() => routeur.back()}
      style={styles.retour}
    >
      <Icon name="chevron-left" size={20} color={couleurs.textBody} />
    </Pressable>
  );

  if (!connu) return null;

  if (echec && texte === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[8] }]}>
        {retour}
        <Banner intent="error">{echec}</Banner>
        <View style={{ marginTop: nativeSpace[12] }}>
          <Button variant="outline" full icon="refresh-cw" onPress={() => void charge()}>
            {t.maintReessayer}
          </Button>
        </View>
      </View>
    );
  }

  if (texte === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[8] }]}>
        {retour}
        <LoadingState variant="liste" rows={6} title={t.chargement} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={[styles.page, {
        paddingTop: insets.top + nativeSpace[8],
        paddingBottom: insets.bottom + nativeSpace[40],
      }]}
    >
      {retour}
      {blocsDeMarkdown(texte).map((bloc, rang) => {
        if (bloc.sorte === "titre") {
          return (
            <Text
              key={rang}
              accessibilityRole="header"
              style={[
                bloc.rang === 1 ? styles.titre : bloc.rang === 2 ? styles.sousTitre : styles.rubrique,
                { color: couleurs.textBody },
              ]}
            >
              {bloc.texte}
            </Text>
          );
        }
        if (bloc.sorte === "point") {
          return (
            <View key={rang} style={styles.puce}>
              <Text style={[styles.corps, { color: couleurs.textMention }]}>·</Text>
              <Text style={[styles.corps, styles.pleine, { color: couleurs.textSecondary }]}>
                {bloc.texte}
              </Text>
            </View>
          );
        }
        return (
          <Text key={rang} style={[styles.corps, styles.espace, { color: couleurs.textSecondary }]}>
            {bloc.texte}
          </Text>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: nativeSpace[16] },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  titre: {
    fontFamily: nativeFont.displayMedium, fontSize: 24, marginTop: nativeSpace[16],
    letterSpacing: nativeLetterSpacing(24, nativeTracking.display),
  },
  sousTitre: {
    fontFamily: nativeFont.displayMedium, fontSize: 18, marginTop: nativeSpace[24],
    letterSpacing: nativeLetterSpacing(18, nativeTracking.display),
  },
  rubrique: { fontFamily: nativeFont.bodySemibold, fontSize: 15, marginTop: nativeSpace[16] },
  corps: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5, lineHeight: 22 },
  espace: { marginTop: nativeSpace[12] },
  puce: { flexDirection: "row", gap: nativeSpace[8], marginTop: nativeSpace[8] },
  pleine: { flex: 1 },
});

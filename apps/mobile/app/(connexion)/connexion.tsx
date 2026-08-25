import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  nativeFont, nativeLetterSpacing, nativeSpace, nativeTracking,
} from "@lehno/tokens";
import { Banner, Button, TextField, Wordmark, useTheme } from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appelPublic, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";

/* La connexion. Le logotype seul — la pastille répéterait le h que le mot
   contient déjà, et c'est l'icône qu'on vient de toucher pour arriver ici. */
export default function Connexion() {
  const { t, langue } = useLangue();
  const { theme, couleurs } = useTheme();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const demandeLeCode = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      await appelPublic("/auth/otp", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      routeur.push({ pathname: "/(connexion)/code", params: { email: email.trim() } });
    } catch (e) {
      setErreur(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.plein} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingTop: insets.top + nativeSpace[20], paddingBottom: insets.bottom + nativeSpace[20] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.marque}>
          <Wordmark variant={theme === "dark" ? "blanc" : "couleur"} height={30} />
        </View>

        <Text style={[styles.titre, { color: couleurs.textBody }]}>{t.connexionTitre}</Text>
        <Text style={[styles.texte, { color: couleurs.textSecondary }]}>{t.connexionTexte}</Text>

        {erreur ? (
          <View style={styles.bandeau}><Banner intent="error">{erreur}</Banner></View>
        ) : null}

        <View style={{ gap: nativeSpace[10] }}>
          <Button variant="outline" full>{t.avecGoogle}</Button>
          <Button variant="outline" full>{t.avecApple}</Button>
        </View>

        <View style={styles.separateur}>
          <View style={[styles.filet, { backgroundColor: couleurs.borderHairline }]} />
          <Text style={[styles.ou, { color: couleurs.textMention }]}>{t.ou}</Text>
          <View style={[styles.filet, { backgroundColor: couleurs.borderHairline }]} />
        </View>

        <TextField
          label={t.champEmail}
          placeholder={t.champEmailEx}
          value={email}
          onChangeText={setEmail}
        />
        <Button
          variant="primary"
          full
          disabled={envoi || email.trim().length === 0}
          onPress={demandeLeCode}
          style={{ marginTop: nativeSpace[12] }}
        >
          {t.recevoirCode}
        </Button>

        {/* Le pied s'écrit en morceaux nommés plutôt qu'en une phrase à trous :
            l'ordre des liens n'est pas le même d'une langue à l'autre. */}
        <Text style={[styles.pied, { color: couleurs.textMention }]}>
          {t.connexionPiedAvant}
          <Text style={{ color: couleurs.textAccent }}>{t.connexionPiedCgu}</Text>
          {t.connexionPiedEntre}
          <Text style={{ color: couleurs.textAccent }}>{t.connexionPiedConf}</Text>
          {t.connexionPiedApres}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1 },
  contenu: { flexGrow: 1, paddingHorizontal: nativeSpace[20] },
  marque: { alignItems: "center", marginBottom: nativeSpace[20] },
  titre: {
    fontFamily: nativeFont.displayMedium, fontSize: 24, textAlign: "center",
    letterSpacing: nativeLetterSpacing(24, nativeTracking.title), marginBottom: nativeSpace[6],
  },
  texte: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5, textAlign: "center", lineHeight: 22, marginBottom: nativeSpace[24] },
  bandeau: { marginHorizontal: -nativeSpace[20], marginBottom: nativeSpace[16] },
  separateur: { flexDirection: "row", alignItems: "center", gap: nativeSpace[12], marginVertical: nativeSpace[16] },
  filet: { flex: 1, height: 1 },
  ou: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5 },
  pied: { marginTop: "auto", paddingTop: nativeSpace[16], fontFamily: nativeFont.bodyRegular, fontSize: 12, textAlign: "center", lineHeight: 18 },
});

import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { nativeFont, nativeLetterSpacing, nativeSpace, nativeTracking } from "@lehno/tokens";
import { Button, TextField, useTheme } from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";

/* Le pseudo. Pas de sous-titre : l'aperçu de l'adresse sous le champ montre
 * qu'il est public, et mieux qu'une phrase ne le dirait.
 *
 * La disponibilité se demande au fil de la frappe, mais après une pause — un
 * appel par caractère saturerait le serveur et ferait clignoter l'aide sous le
 * champ à chaque touche.
 */
const PAUSE = 400;

export default function Pseudo() {
  const { t, langue } = useLangue();
  const { couleurs } = useTheme();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [pseudo, setPseudo] = useState("");
  const [pris, setPris] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (pseudo.trim().length < 3) { setPris(false); return; }
    let vivant = true;
    const minuteur = setTimeout(async () => {
      try {
        const r = await appel<{ available: boolean }>(
          `/me/profile/username-available?username=${encodeURIComponent(pseudo.trim())}`,
        );
        if (vivant) setPris(!r.available);
      } catch {
        // Une vérification qui échoue ne bloque pas : le serveur retranchera à
        // l'enregistrement, et c'est lui qui décide.
        if (vivant) setPris(false);
      }
    }, PAUSE);
    return () => { vivant = false; clearTimeout(minuteur); };
  }, [pseudo]);

  const enregistre = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      await appel("/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ username: pseudo.trim() }),
      });
      routeur.replace("/(connexion)/bienvenue");
    } catch (e) {
      const enveloppe = e instanceof ErreurDApi ? e.enveloppe : null;
      if (enveloppe?.code === "username_taken") setPris(true);
      else setErreur(messageDErreur(enveloppe, langue));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.plein} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.contenu, { paddingTop: insets.top + nativeSpace[20], paddingBottom: insets.bottom + nativeSpace[20] }]}>
        <Text style={[styles.titre, { color: couleurs.textBody }]}>{t.pseudoTitre}</Text>

        <TextField
          label={t.champPseudo}
          value={pseudo}
          onChangeText={setPseudo}
          invalid={pris}
          hint={pris ? t.pseudoPris : t.pseudoAdresse}
        />

        {erreur ? <Text style={[styles.erreur, { color: couleurs.feedbackError }]}>{erreur}</Text> : null}

        {/* Les conditions sont acceptées à la connexion. Les rappeler ici
            ferait signer deux fois pour un seul engagement. */}
        <Button
          variant="primary"
          full
          disabled={envoi || pris || pseudo.trim().length < 3}
          onPress={enregistre}
          style={{ marginTop: "auto" }}
        >
          {t.continuer}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1 },
  contenu: { flex: 1, paddingHorizontal: nativeSpace[20] },
  titre: {
    fontFamily: nativeFont.displayMedium, fontSize: 25,
    letterSpacing: nativeLetterSpacing(25, nativeTracking.title),
    marginBottom: nativeSpace[24],
  },
  erreur: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginTop: nativeSpace[12] },
});

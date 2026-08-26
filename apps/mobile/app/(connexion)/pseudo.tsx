import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { nativeFont, nativeLetterSpacing, nativeSpace, nativeTracking } from "@lehno/tokens";
import { Banner, Button, TextField, useTheme } from "@lehno/ui-native";
import { registrationUsernameSchema, sessionSchema } from "@lehno/contracts";
import { useLangue } from "../../lib/langue.js";
import { appelPublic, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { poseLesJetons } from "../../lib/jetons.js";
import { identifiantDeLAppareil } from "../../lib/appareil.js";

/* Le pseudo — et c'est ici que le compte naît.
 *
 * Le jeton d'inscription arrive de l'écran du code et ne sert qu'à ça : il
 * n'ouvre rien, ne se range nulle part, et meurt avec cet écran. C'est la
 * réponse de `/auth/register` qui apporte les vrais jetons.
 *
 * Pas de sous-titre : l'aperçu de l'adresse sous le champ montre que le pseudo
 * est public, et mieux qu'une phrase ne le dirait.
 */
export default function Pseudo() {
  const { t, langue } = useLangue();
  const { couleurs } = useTheme();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { registrationToken, plafondAtteint } = useLocalSearchParams<{
    registrationToken: string;
    plafondAtteint: string;
  }>();

  const [pseudo, setPseudo] = useState("");
  const [parrain, setParrain] = useState("");
  const [pris, setPris] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  /* Le plafond de comptes est atteint sur cet appareil : la création est
     refusée, et le dire ici évite de choisir un pseudo pour rien. Le serveur
     l'a annoncé avec le jeton, avant qu'on ait rien saisi. */
  const refuse = plafondAtteint === "1";

  // La forme se vérifie ici pour éteindre le bouton ; le serveur tranche.
  const formeValide = registrationUsernameSchema.safeParse(pseudo).success;

  const inscris = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      const appareil = await identifiantDeLAppareil();
      const brut = await appelPublic<unknown>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          registrationToken,
          username: pseudo,
          deviceId: appareil,
          ...(parrain.trim() ? { referralCode: parrain.trim() } : {}),
        }),
      });
      const session = sessionSchema.parse(brut);
      await poseLesJetons(session);

      // Les crédits offerts viennent du serveur : les écrire en dur les ferait
      // mentir dès que le montant change en administration.
      routeur.replace({
        pathname: "/(connexion)/bienvenue",
        params: { credits: String(session.signupCredits ?? 0) },
      });
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

        {refuse ? (
          <View style={styles.bandeau}>
            <Banner intent="warning">{t.plafondAppareil}</Banner>
          </View>
        ) : null}

        <TextField
          label={t.champPseudo}
          nature="pseudo"
          value={pseudo}
          onChangeText={(v) => { setPseudo(v); setPris(false); }}
          invalid={pris}
          hint={pris ? t.pseudoPris : t.pseudoAdresse}
        />

        <View style={{ marginTop: nativeSpace[16] }}>
          <TextField
            label={t.champParrain}
            nature="pseudo"
            value={parrain}
            onChangeText={setParrain}
            hint={t.parrainFacultatif}
          />
        </View>

        {erreur ? <Text style={[styles.erreur, { color: couleurs.feedbackError }]}>{erreur}</Text> : null}

        {/* Les conditions sont acceptées à la connexion. Les rappeler ici ferait
            signer deux fois pour un seul engagement. */}
        <Button
          variant="primary"
          full
          disabled={envoi || refuse || pris || !formeValide}
          onPress={inscris}
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
  bandeau: { marginHorizontal: -nativeSpace[20], marginBottom: nativeSpace[16] },
  erreur: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginTop: nativeSpace[12] },
});

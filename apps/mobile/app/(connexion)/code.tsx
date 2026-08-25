import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  nativeFont, nativeLetterSpacing, nativeRadius, nativeSpace, nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import { Banner, Button, Icon, Illustration, useTheme } from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { useCompact } from "../../lib/compact.js";
import { appelPublic, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { poseLesJetons } from "../../lib/jetons.js";
import type { Session } from "@lehno/contracts";

const LONGUEUR = 6;
const VALIDITE = 10 * 60;
const RENVOI = 45;

function horloge(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  if (!m) return `${s} s`;
  return `${m} min ${String(s).padStart(2, "0")} s`;
}

/* Deux horloges, et elles ne se confondent pas : la validité du code (dix
 * minutes) et le délai avant de pouvoir en redemander un. La première dit
 * combien de temps il reste pour saisir, la seconde quand on peut recommencer.
 *
 * Un seul champ, invisible, plutôt que six. Six champs se disputeraient le
 * focus, casseraient le collage et priveraient du remplissage automatique du
 * code reçu — que le système propose au-dessus du clavier, et qui est la façon
 * dont la plupart des gens saisiront ce code.
 */
export default function Code() {
  const { t, langue } = useLangue();
  const { couleurs } = useTheme();
  const insets = useSafeAreaInsets();
  const compact = useCompact();
  const routeur = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  const champ = useRef<TextInput>(null);
  const [saisi, setSaisi] = useState("");
  const [reste, setReste] = useState(VALIDITE);
  const [avantRenvoi, setAvantRenvoi] = useState(RENVOI);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    const battement = setInterval(() => {
      setReste((v) => (v > 0 ? v - 1 : 0));
      setAvantRenvoi((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(battement);
  }, []);

  const perime = reste === 0;

  const valide = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      const session = await appelPublic<Session>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email, code: saisi }),
      });
      await poseLesJetons(session);
      // `isNewAccount` décide de la suite : un compte qui vient de naître passe
      // par le pseudo, un compte connu retrouve directement son espace.
      routeur.replace(session.isNewAccount ? "/(connexion)/pseudo" : "/");
    } catch (e) {
      setErreur(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
      setSaisi("");
    } finally {
      setEnvoi(false);
    }
  };

  const renvoie = async () => {
    setErreur(null);
    try {
      await appelPublic("/auth/otp", { method: "POST", body: JSON.stringify({ email }) });
      setReste(VALIDITE);
      setAvantRenvoi(RENVOI);
    } catch (e) {
      setErreur(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  const cote = compact ? 38 : 42;
  const hauteurCase = compact ? nativeTouchMin : 52;

  return (
    <KeyboardAvoidingView style={styles.plein} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.contenu, { paddingTop: insets.top + nativeSpace[8], paddingBottom: insets.bottom + nativeSpace[20] }]}>
        {/* Le chevron porte ses 44 points par une marge négative : la cible
            tactile s'élargit sans décaler le titre. */}
        <Pressable
          onPress={() => routeur.back()}
          accessibilityRole="button"
          accessibilityLabel={t.retour}
          style={styles.retour}
        >
          <Icon name="chevron-left" size={22} color={couleurs.textBody} />
        </Pressable>

        <View style={{ width: compact ? 84 : 140, alignSelf: "center", marginTop: compact ? 0 : nativeSpace[10] }}>
          <Illustration name="verification-code" width={compact ? 84 : 140} />
        </View>

        <Text style={[styles.titre, {
          color: couleurs.textBody,
          fontSize: compact ? 21 : 23,
          marginTop: compact ? nativeSpace[6] : nativeSpace[10],
        }]}>{t.codeTitre}</Text>
        <Text style={[styles.texte, {
          color: couleurs.textSecondary, marginBottom: compact ? nativeSpace[12] : 22,
        }]}>{t.codeTexte}</Text>

        {erreur ? <View style={styles.bandeau}><Banner intent="error">{erreur}</Banner></View> : null}
        {perime && !erreur ? <View style={styles.bandeau}><Banner intent="warning">{t.codeExpire}</Banner></View> : null}

        <Pressable onPress={() => champ.current?.focus()} style={styles.cases} accessibilityLabel={t.codeTitre}>
          {Array.from({ length: LONGUEUR }).map((_, rang) => (
            <View
              key={rang}
              style={[styles.case_, {
                width: cote,
                height: hauteurCase,
                borderRadius: nativeRadius.sm,
                borderColor: erreur ? couleurs.feedbackError : couleurs.borderObject,
                backgroundColor: couleurs.surfaceCard,
              }]}
            >
              <Text style={[styles.chiffre, { color: couleurs.textBody, fontSize: compact ? 22 : 24 }]}>
                {saisi[rang] ?? ""}
              </Text>
            </View>
          ))}
        </Pressable>

        <TextInput
          ref={champ}
          value={saisi}
          onChangeText={(v) => setSaisi(v.replace(/\D/g, "").slice(0, LONGUEUR))}
          keyboardType="number-pad"
          // Le système propose le code reçu au-dessus du clavier : c'est la
          // façon dont la plupart des gens le saisiront.
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          maxLength={LONGUEUR}
          style={styles.invisible}
        />

        <Text style={[styles.validite, { color: couleurs.textMention }]}>
          {perime ? "" : t.codeValidite(horloge(reste))}
        </Text>

        <Button
          variant="primary"
          full
          disabled={envoi || saisi.length < LONGUEUR}
          onPress={valide}
          style={{ marginTop: compact ? nativeSpace[10] : 18 }}
        >
          {t.valider}
        </Button>

        <View style={styles.renvoi}>
          {avantRenvoi > 0 ? (
            <Text style={[styles.attente, { color: couleurs.textMention }]}>{t.codeRenvoiAttente(avantRenvoi)}</Text>
          ) : (
            <Button variant="text" onPress={renvoie}>{t.renvoyerCode}</Button>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1 },
  contenu: { flex: 1, paddingHorizontal: nativeSpace[20] },
  retour: {
    alignSelf: "flex-start", alignItems: "center", justifyContent: "center",
    minWidth: nativeTouchMin, minHeight: nativeTouchMin, marginLeft: -11,
  },
  titre: {
    fontFamily: nativeFont.displayMedium, textAlign: "center",
    letterSpacing: nativeLetterSpacing(23, nativeTracking.title), marginBottom: nativeSpace[6],
  },
  texte: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5, textAlign: "center", lineHeight: 22 },
  bandeau: { marginHorizontal: -nativeSpace[20], marginBottom: nativeSpace[12] },
  cases: { flexDirection: "row", justifyContent: "space-between" },
  case_: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  chiffre: { fontFamily: nativeFont.displayMedium },
  // Hors de l'écran plutôt que masqué : un champ à opacité nulle reste
  // touchable et vole le focus aux cases.
  invisible: { position: "absolute", opacity: 0, left: -9999 },
  validite: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, textAlign: "center", marginTop: nativeSpace[12], minHeight: 18 },
  renvoi: { alignItems: "center", marginTop: "auto", paddingTop: nativeSpace[12] },
  attente: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5 },
});

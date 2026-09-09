import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { nativeFont, nativeLetterSpacing, nativeSpace, nativeTracking } from "@lehno/tokens";
import { Banner, Button, TextField, useTheme } from "@lehno/ui-native";
import { registeredSchema, usernameSchema } from "@lehno/contracts";
import { useLangue } from "../../lib/langue.js";
import { doitVerifierLeParrain, type EtatDuParrain } from "../../lib/parrainage.js";
import { appel, appelPublic, ErreurDApi } from "../../lib/api.js";
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
  /* `null` = on ne sait pas encore. L'écran se tait alors : marquer « invalide »
     pendant que la requête vole ferait clignoter un reproche à chaque lettre. */
  const [etatParrain, setEtatParrain] = useState<EtatDuParrain>(null);
  const [pris, setPris] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  /* LE CODE SE VÉRIFIE À LA SAISIE, pas après l'inscription.
     
     Sans cela, on découvrait qu'il était mauvais sur l'écran de bienvenue —
     donc APRÈS la création du compte, quand il est trop tard pour le corriger.
     Le contrat prévoyait ce geste : la description de la route le dit mot pour
     mot, « sert aussi à valider un code de parrainage à la saisie, avant de le
     soumettre à /auth/register : un code inconnu rend 404 ».
     
     400 ms, comme la vérification du pseudo ailleurs : assez pour ne pas
     interroger sur le chemin d'un code qu'on est en train de taper, assez peu
     pour que la réponse arrive avant qu'on n'appuie.
     
     Une panne autre qu'un 404 rend `null` : on se tait plutôt que d'accuser un
     code peut-être bon parce que le réseau a hoqueté. */
  useEffect(() => {
    if (!doitVerifierLeParrain(parrain)) { setEtatParrain(null); return; }
    let vivant = true;
    setEtatParrain(null);
    const minuteur = setTimeout(() => {
      void appelPublic<unknown>(`/public/invitations/${encodeURIComponent(parrain.trim())}`)
        .then(() => { if (vivant) setEtatParrain("valide"); })
        .catch((e: unknown) => {
          if (!vivant) return;
          const code = e instanceof ErreurDApi ? e.enveloppe?.code : null;
          setEtatParrain(code === "not_found" ? "invalide" : null);
        });
    }, 400);
    return () => { vivant = false; clearTimeout(minuteur); };
  }, [parrain]);
  const [envoi, setEnvoi] = useState(false);

  /* Le plafond de comptes est atteint sur cet appareil : la création est
     refusée, et le dire ici évite de choisir un pseudo pour rien. Le serveur
     l'a annoncé avec le jeton, avant qu'on ait rien saisi. */
  const refuse = plafondAtteint === "1";

  // La forme se vérifie ici pour éteindre le bouton ; le serveur tranche.
  const formeValide = usernameSchema.safeParse(pseudo).success;

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
      const session = registeredSchema.parse(brut);
      await poseLesJetons(session);

      /* LA LANGUE DE L'APPAREIL SUIT LE COMPTE, dès sa naissance.
       *
       * `user.ui_language` a `@default("fr")` en base : un compte créé depuis
       * un téléphone anglais naissait donc en français. L'interface, elle,
       * suit l'appareil — on lisait « Français » dans un écran de réglages
       * entièrement en anglais, deux vérités côte à côte.
       *
       * Et ce n'est pas qu'un affichage : c'est `ui_language` qui décide de la
       * langue des COURRIELS. Le code de connexion serait parti en français à
       * quelqu'un qui n'en lit pas un mot.
       *
       * On l'envoie donc APRÈS la pose des jetons — la route est authentifiée —
       * et son échec ne compromet rien : le compte existe, la session est
       * ouverte, seule la préférence attendra le prochain passage aux réglages.
       */
      try {
        await appel<unknown>("/me/profile", {
          method: "PATCH",
          body: JSON.stringify({ uiLanguage: langue }),
        });
      } catch {
        /* Silencieux à dessein : interrompre une inscription réussie pour une
           préférence d'affichage ferait payer cher une chose qui se répare en
           deux appuis. */
      }

      // Les crédits offerts viennent du serveur : les écrire en dur les ferait
      // mentir dès que le montant change en administration.
      routeur.replace({
        pathname: "/(connexion)/bienvenue",
        params: {
          pseudo,
          credits: String(session.signupCredits),
          /* Le cadeau de lancement — celui qui récompense l'attente. NUL quand
             la personne n'attendait pas, jamais zéro : le serveur l'a détecté
             sur l'ADRESSE, pas sur un jeton porté par le lien — un bonus dans
             le lien serait transférable. Le client lit ce champ, c'est tout. */
          attente: String(session.waitlistBonus ?? 0),
          /* L'issue voyage avec le bonus : sans elle, un code introuvable et
             un code absent se ressembleraient, et l'écran se tairait là où il
             doit constater. */
          bonus: String(session.referral?.bonusCredits ?? 0),
          issueParrain: session.referral?.outcome ?? "",
        },
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
          hint={pris ? t.pseudoPris : t.pseudoAdresse(pseudo)}
        />

        <View style={{ marginTop: nativeSpace[16] }}>
          <TextField
            label={t.champParrain}
            nature="pseudo"
            value={parrain}
            onChangeText={setParrain}
            {...(etatParrain === "valide" ? { valide: true } : {})}
            {...(etatParrain === "invalide" ? { invalid: true } : {})}
            hint={etatParrain === "valide" ? t.parrainValide
              : etatParrain === "invalide" ? t.parrainInvalide
                : t.parrainFacultatif}
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

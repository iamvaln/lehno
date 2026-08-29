import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  publicConfigSchema, referralSummarySchema, type ReferralSummary,
} from "@lehno/contracts";
import {
  nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Banner, Button, Card, Icon, LoadingState, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, appelPublic, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { annonceUnGain, codePartageable, filleulsAboutis } from "../../lib/parrainage.js";

/* Parrainage — §3.29.
 *
 * LE SECOND CHEMIN VERS DES CRÉDITS, et le seul qui n'en coûte pas. Il compte
 * d'autant plus au lancement, où l'achat passe par un versement manuel.
 *
 * LE CODE VIENT DU SERVEUR. Le handoff le donne en dur — « VAL-4KX2 » — et
 * figé, tout le monde partagerait le même : les filleuls seraient rattachés à
 * un compte qui n'est pas le leur, ou à aucun.
 *
 * LE GAIN SE LIT DANS `bonusParInvitation`, jamais dans les drapeaux. Nul, le
 * parrainage se présente SANS chiffre : il vit encore — l'éteindre « tuerait
 * l'acquisition avec la monétisation » — mais n'a plus de crédits à promettre.
 * Croiser `referral` et `credits` soi-même referait le raisonnement du serveur.
 */
export default function Parrainage() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [resume, setResume] = useState<ReferralSummary | null>(null);
  const [pourEux, setPourEux] = useState<number | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      /* Deux sources, et elles ne disent pas la même chose : ce que MOI je
         gagne vient de `/me/referral`, ce que l'INVITÉ reçoit de la
         configuration publique. Les confondre annoncerait un chiffre pour
         l'autre. */
      const [brutResume, brutConfig] = await Promise.all([
        appel<unknown>("/me/referral"),
        appelPublic<unknown>("/public/config"),
      ]);
      setResume(referralSummarySchema.parse(brutResume));
      setPourEux(publicConfigSchema.parse(brutConfig).referralBonusInvited);
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useEffect(() => { void charge(); }, [charge]);

  if (echec && !resume) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <Banner intent="error">{echec}</Banner>
        <View style={{ marginTop: nativeSpace[12] }}>
          <Button variant="outline" full icon="refresh-cw" onPress={() => void charge()}>
            {t.maintReessayer}
          </Button>
        </View>
      </View>
    );
  }

  if (!resume) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  const code = codePartageable(resume);
  const aboutis = filleulsAboutis(resume);
  /* La phrase chiffrée ne paraît que si les DEUX montants sont là : celui du
     serveur et celui de la configuration. Il en manque un, on présente le
     parrainage sans promesse plutôt qu'avec une moitié de promesse. */
  const chiffre = annonceUnGain(resume) && pourEux !== null;

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={[styles.page, {
        paddingTop: insets.top + nativeSpace[8],
        paddingBottom: insets.bottom + nativeSpace[24],
      }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.retour}
        onPress={() => routeur.back()}
        style={styles.retour}
      >
        <Icon name="chevron-left" size={20} color={couleurs.textBody} />
      </Pressable>

      {echec ? (
        <View style={{ marginBottom: nativeSpace[12] }}>
          <Banner intent="error">{echec}</Banner>
        </View>
      ) : null}

      <Text style={[styles.titre, { color: couleurs.textBody }]} accessibilityRole="header">
        {t.parrainageTitre}
      </Text>
      {chiffre ? (
        <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
          {t.parrainageTexte(pourEux, resume.bonusParInvitation ?? 0)}
        </Text>
      ) : null}

      {code ? (
        <>
          <Card surface="panel" padding={16} radius="lg" style={styles.bloc}>
            {/* Sélectionnable : l'appui long copie, faute de presse-papiers
                embarqué — et un bouton « Copier » qui ne copierait rien serait
                pire que son absence. Le partage, lui, marche. */}
            <Text selectable style={[styles.code, { color: couleurs.textBody }]}>
              {code}
            </Text>
          </Card>
          <View style={{ marginTop: nativeSpace[12] }}>
            <Button
              full
              icon="send"
              onPress={() => void Share.share({ message: code })}
            >
              {t.parrainagePartager}
            </Button>
          </View>
        </>
      ) : null}

      <View style={styles.bloc}>
        <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
          {aboutis ? t.parrainageFilleuls(aboutis) : t.parrainageAucun}
        </Text>
      </View>
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
    fontFamily: nativeFont.displayMedium, fontSize: 22, marginTop: nativeSpace[8],
    letterSpacing: nativeLetterSpacing(22, nativeTracking.display),
  },
  texte: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5, marginTop: nativeSpace[8] },
  bloc: { marginTop: nativeSpace[20] },
  code: {
    fontFamily: nativeFont.displayMedium, fontSize: 26, textAlign: "center",
    letterSpacing: nativeLetterSpacing(26, nativeTracking.display),
  },
});

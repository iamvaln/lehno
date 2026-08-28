import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  occurrenceSchema, type GenerationKind, type Occurrence,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeLetterSpacing, nativeRadius, nativeSpace,
  nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Banner, Button, Icon, LoadingState, SensitiveBanner, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { composeLaDemande, pistesOffertes } from "../../lib/preparation.js";

/* Préparer une occasion — §3.7.
 *
 * « RIEN NE PART SANS VOUS » : cet écran ne fait rien tout seul. Il propose,
 * on choisit, et ce qui est produit se relit avant d'être envoyé.
 *
 * Deux pistes, chacune sur son drapeau — les trois natures de génération sont
 * trois drapeaux, pas un interrupteur. Au lancement seul le message est
 * allumé : c'est le cas NOMINAL, et l'écran s'ouvre quand même.
 */
export default function Preparation() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { occurrenceId } = useLocalSearchParams<{ occurrenceId: string }>();
  const { actives } = useDrapeaux();

  const [occasion, setOccasion] = useState<Occurrence | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<GenerationKind | null>(null);

  const charge = useCallback(async () => {
    try {
      setOccasion(occurrenceSchema.parse(await appel<unknown>(`/me/occurrences/${occurrenceId}`)));
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [occurrenceId, langue]);

  useEffect(() => { void charge(); }, [charge]);

  /* LE CRÉDIT EST DÉBITÉ À LA DEMANDE, pas à l'affichage. La clé d'idempotence
     rend deux appuis maladroits reconnaissables comme une seule demande — sans
     elle, ils feraient deux générations et deux débits. */
  const lance = async (kind: GenerationKind): Promise<void> => {
    if (!occurrenceId) return;
    setEnvoi(kind);
    setEchec(null);
    try {
      await appel<unknown>("/me/generations", {
        method: "POST",
        body: JSON.stringify(composeLaDemande(kind, occurrenceId)),
        gouvernee: true,
      });
      routeur.push("/(app)/reprises");
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(null);
    }
  };

  if (echec && !occasion) {
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

  if (!occasion) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={2} title={t.chargement} />
      </View>
    );
  }

  const pistes = pistesOffertes(occasion, actives);
  const sensible = occasion.nature === "sensitive";

  const detail: Record<GenerationKind, { titre: string; texte: string }> = {
    wish_message: { titre: t.prepMessageTitre, texte: t.prepMessageTexte },
    gift_ideas: { titre: t.prepIdeesTitre, texte: t.prepIdeesTexte },
    portrait: { titre: t.fichePortraits, texte: "" },
  };

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={[styles.page, {
        paddingTop: insets.top + nativeSpace[12],
        paddingBottom: insets.bottom + nativeSpace[24],
      }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.retour}
        onPress={() => routeur.back()}
        style={styles.retour}
      >
        <Icon name="chevron-left" size={22} color={couleurs.textBody} />
      </Pressable>

      <Text style={[styles.titre, { color: couleurs.textBody }]}>
        {t.prepPour(occasion.personDisplayName)}
      </Text>
      {/* « Rien ne part sans vous » : l'écran propose, il n'envoie pas. */}
      <Text style={[styles.intro, { color: couleurs.textSecondary }]}>{t.prepIntro}</Text>

      {/* UNE OCCASION SENSIBLE N'A PAS D'IDÉES DE CADEAU, et le dit plutôt que
          de laisser un vide : un bouton grisé aurait suggéré qu'on y avait
          pensé. Le message, lui, demeure — c'est même le seul moment où il
          compte vraiment. */}
      {sensible ? (
        <View style={styles.bandeau}>
          <SensitiveBanner>{t.prepSensible}</SensitiveBanner>
        </View>
      ) : null}

      {echec ? (
        <View style={styles.bandeau}>
          <Banner intent="error">{echec}</Banner>
        </View>
      ) : null}

      {pistes.map(({ kind }) => (
        <View key={kind} style={[styles.piste, { borderColor: couleurs.borderObject }]}>
          <Text style={[styles.pisteTitre, { color: couleurs.textBody }]}>
            {detail[kind].titre}
          </Text>
          <Text style={[styles.pisteTexte, { color: couleurs.textSecondary }]}>
            {detail[kind].texte}
          </Text>
          <View style={{ marginTop: nativeSpace[12] }}>
            <Button
              variant="primary"
              full
              icon="sparkles"
              disabled={envoi !== null}
              onPress={() => void lance(kind)}
            >
              {t.preparer}
            </Button>
          </View>
        </View>
      ))}
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
    fontFamily: nativeFont.displayMedium, fontSize: 25,
    letterSpacing: nativeLetterSpacing(25, nativeTracking.title),
  },
  intro: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5, marginTop: nativeSpace[4] },
  bandeau: { marginTop: nativeSpace[16] },
  piste: {
    marginTop: nativeSpace[16], padding: nativeSpace[16],
    borderWidth: nativeBorder.width, borderRadius: nativeRadius.lg,
  },
  pisteTitre: { fontFamily: nativeFont.displayRegular, fontSize: 18 },
  pisteTexte: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginTop: nativeSpace[4], lineHeight: 20 },
});

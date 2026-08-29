import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  creditBalanceSchema, occurrenceSchema, type GenerationKind, type Occurrence,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeLetterSpacing, nativeRadius, nativeSpace,
  nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Banner, Button, Icon, LoadingState, PaidActionSheet, SensitiveBanner, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { useActionsPayantes } from "../../lib/MetadonneesProvider.js";
import { composeLaDemande, coutDe, pistesOffertes } from "../../lib/preparation.js";

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
  const prix = useActionsPayantes();

  const [occasion, setOccasion] = useState<Occurrence | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<GenerationKind | null>(null);
  /* RIEN NE SE PAIE EN SILENCE : le coût s'annonce sur place, passe par la
     feuille de confirmation, et ce qui est produit se relit. La piste choisie
     attend donc la confirmation avant de partir. */
  const [aConfirmer, setAConfirmer] = useState<GenerationKind | null>(null);
  const [solde, setSolde] = useState<number | null>(null);

  const charge = useCallback(async () => {
    try {
      /* Le solde vient avec l'occasion : la feuille l'annonce à côté du coût,
         et l'aller chercher au moment du geste ferait attendre devant une
         question qu'on vient de poser. */
      const [occ, credits] = await Promise.all([
        appel<unknown>(`/me/occurrences/${occurrenceId}`),
        appel<unknown>("/me/credits"),
      ]);
      setOccasion(occurrenceSchema.parse(occ));
      setSolde(creditBalanceSchema.parse(credits).balance);
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

  /* Le coût de la piste qu'on s'apprête à confirmer, NARROWÉ une fois pour
     toutes : un `?? 0` au moment de l'affichage recopierait un prix — zéro —
     que le serveur n'a pas servi. Nul, la feuille ne s'ouvre pas. */
  const coutARegler = aConfirmer === null ? null : coutDe(prix, aConfirmer);

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
              disabled={envoi !== null || coutDe(prix, kind) === null}
              onPress={() => setAConfirmer(kind)}
            >
              {t.preparer}
            </Button>
          </View>
        </View>
      ))}
      {/* Le coût est LU EN BASE, jamais écrit ici : il se règle en
          administration sans livraison, et un écran qui annonce un prix avant
          de débiter ne peut pas se tromper. Une action dont le prix n'est pas
          servi ne se lance pas — son bouton reste éteint plutôt que d'ouvrir
          une feuille qui ne saurait quoi annoncer.

          ET ELLE S'OUVRE TOUJOURS : il n'y a pas de mode gratuit. Le crédit se
          consomme quoi qu'il arrive, donc le coût s'annonce quoi qu'il
          arrive. */}
      {aConfirmer !== null && coutARegler !== null && solde !== null ? (
        <PaidActionSheet
          surTitre={t.prepPour(occasion.personDisplayName)}
          titre={detail[aConfirmer].titre}
          resultat={detail[aConfirmer].texte}
          coutLibelle={t.creditUnite(coutARegler)}
          soldeLibelle={t.creditReste(solde)}
          lancer={t.feuilleLancer}
          recharger={t.feuilleRecharger}
          pasMaintenant={t.feuillePasMaintenant}
          cout={coutARegler}
          solde={solde}
          onConfirmer={() => {
            const kind = aConfirmer;
            setAConfirmer(null);
            void lance(kind);
          }}
          onAnnuler={() => setAConfirmer(null)}
        />
      ) : null}
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

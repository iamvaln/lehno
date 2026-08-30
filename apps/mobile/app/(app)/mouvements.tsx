import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  creditBalanceSchema, CREDIT_REASON_LABELS, type CreditTransaction,
} from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, EmptyState, Icon, LoadingState, SectionLabel, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { dateCourte } from "../../lib/carnet.js";
import { moisDesMouvements, montreLeMouvement } from "../../lib/versement.js";
import { titreDuMois } from "../../lib/dates.js";

/* Mouvements — §3.32.
 *
 * IL EXISTE PARCE QUE TROIS LIGNES NE SUFFISENT PAS À UNE RÉCLAMATION. §3.9 en
 * montre les trois derniers — c'est ce qu'on vient vérifier après un versement.
 * Quand on cherche « où sont passés mes crédits », il faut la suite.
 *
 * LES LIBELLÉS SONT CEUX DU CONTRAT, dans les deux langues, et non des phrases
 * de l'écran : les réécrire ici les rendrait introuvables dans le journal du
 * back-office, au moment précis où quelqu'un compare les deux.
 *
 * LES MOIS SÉPARENT, ILS NE TITRENT PAS : un intertitre par mois donnerait à
 * chaque groupe l'air d'une section.
 */
export default function Mouvements() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [mouvements, setMouvements] = useState<CreditTransaction[] | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const lu = creditBalanceSchema.parse(await appel<unknown>("/me/credits"));
      setMouvements([...lu.transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useEffect(() => { void charge(); }, [charge]);

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

  if (echec && mouvements === null) {
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

  if (mouvements === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[8] }]}>
        {retour}
        <LoadingState variant="liste" rows={5} title={t.chargement} />
      </View>
    );
  }

  if (!mouvements.length) {
    return (
      <View style={[styles.page, styles.aumilieu, { paddingTop: insets.top + nativeSpace[8] }]}>
        {retour}
        <EmptyState
          illustration="carnet-neuf"
          title={t.mouvVideTitre}
          text={t.mouvVideTexte}
        />
      </View>
    );
  }

  const groupes = moisDesMouvements(mouvements);
  const anneeCourante = new Date().getUTCFullYear();

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={[styles.page, {
        paddingTop: insets.top + nativeSpace[8],
        paddingBottom: insets.bottom + nativeSpace[24],
      }]}
    >
      {retour}

      {groupes.map((groupe, rang) => (
        <View key={groupe.mois} style={rang ? styles.bloc : undefined}>
          <SectionLabel>{titreDuMois(groupe.mois, langue, anneeCourante)}</SectionLabel>
          {groupe.items.map((m, i) => (
            <View
              key={m.id}
              style={[styles.rang, i > 0 ? {
                borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
              } : null]}
            >
              <View style={styles.corps}>
                <Text style={[styles.quoi, { color: couleurs.textBody }]} numberOfLines={1}>
                  {CREDIT_REASON_LABELS[m.reason][langue === "en" ? "en" : "fr"]}
                </Text>
                <Text style={[styles.quand, { color: couleurs.textMention }]} numberOfLines={1}>
                  {dateCourte(m.createdAt.slice(0, 10), langue)}
                </Text>
              </View>
              {/* Le signe est DANS le texte : quelqu'un qui ne distingue pas le
                  vert lit la même chose que les autres. La couleur ne fait que
                  confirmer. */}
              <Text
                style={[styles.montant, {
                  color: m.amount > 0 ? couleurs.feedbackSuccess : couleurs.textSecondary,
                }]}
              >
                {montreLeMouvement(m.amount)}
              </Text>
            </View>
          ))}
        </View>
      ))}

      <Text style={[styles.note, { color: couleurs.textMention }]}>{t.mouvNote}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: nativeSpace[16] },
  aumilieu: { justifyContent: "center" },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  bloc: { marginTop: nativeSpace[24] },
  rang: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
  },
  corps: { flex: 1, minWidth: 0 },
  quoi: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  quand: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[2] },
  montant: { fontFamily: nativeFont.displayMedium, fontSize: 16 },
  note: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[24] },
});

import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { myReservationListSchema, type MyReservation } from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, EmptyState, Icon, LoadingState, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { dateCourte } from "../../lib/carnet.js";
import { reservationsQuiTiennent } from "../../lib/vitrine.js";

/* Mes réservations — §3.27.
 *
 * CE QUE J'AI PROMIS AUX AUTRES, pas ce qu'on m'a promis. On vient ici pour se
 * rappeler ce qu'on doit acheter, et pour quand — donc la plus proche d'abord.
 *
 * L'IDENTITÉ EST UNE DONNÉE, pas une supposition : `showIdentity` dit si l'on
 * s'est fait connaître de la personne. Le deviner d'un autre champ ferait dire
 * à l'écran l'inverse de ce qu'on a choisi au moment de réserver.
 *
 * IL SE LIT, IL NE SE TOUCHE PAS — et ce n'est pas un choix de dessin. La copie
 * porte trois gestes que le contrat ne sert pas : « Libérer », « Marquer comme
 * offert », et l'état « Retiré par son propriétaire ». On RÉSERVE depuis la
 * liste publique (`POST public/wishlists/:id/reserve`), et rien ne défait ni ne
 * conclut ensuite. Les poser ici ferait trois boutons qui échouent — sur des
 * cadeaux que d'autres attendent.
 */
export default function Reservations() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [reservations, setReservations] = useState<MyReservation[] | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      setReservations(myReservationListSchema.parse(await appel<unknown>("/me/reservations")));
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

  if (echec && reservations === null) {
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

  if (reservations === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[8] }]}>
        {retour}
        <LoadingState variant="liste" rows={4} title={t.chargement} />
      </View>
    );
  }

  if (!reservations.length) {
    return (
      <View style={[styles.page, styles.aumilieu, { paddingTop: insets.top + nativeSpace[8] }]}>
        {retour}
        <EmptyState
          illustration="souhait-reserve"
          title={t.reservVideTitre}
          text={t.reservVideTexte}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={[styles.page, {
        paddingTop: insets.top + nativeSpace[8],
        paddingBottom: insets.bottom + nativeSpace[24],
      }]}
    >
      {retour}
      <Text style={[styles.intro, { color: couleurs.textSecondary }]}>{t.reservIntro}</Text>

      {reservationsQuiTiennent(reservations).map((r, i) => (
        <View
          key={r.id}
          style={[styles.rang, i > 0 ? {
            borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
          } : null]}
        >
          <View style={styles.corps}>
            <Text style={[styles.quoi, { color: couleurs.textBody }]} numberOfLines={2}>
              {r.wishLabel}
            </Text>
            {/* Chez qui, et pour quand : les deux ensemble, parce qu'on cherche
                « ce que je dois acheter avant telle date », jamais l'un sans
                l'autre. */}
            <Text style={[styles.qui, { color: couleurs.textMention }]} numberOfLines={1}>
              {r.ownerDisplayName} · {dateCourte(r.occurrenceDate, langue)}
            </Text>
          </View>
          {/* `showIdentity` est une DONNÉE : elle dit si l'on s'est fait
              connaître. La déduire ferait dire à l'écran l'inverse de ce qu'on
              a choisi au moment de réserver. */}
          {r.showIdentity ? null : (
            <Icon name="eye" size={15} color={couleurs.textMention} />
          )}
        </View>
      ))}
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
  intro: {
    fontFamily: nativeFont.bodyRegular, fontSize: 14, marginTop: nativeSpace[8],
    marginBottom: nativeSpace[8],
  },
  rang: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
  },
  corps: { flex: 1, minWidth: 0 },
  quoi: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  qui: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[2] },
});

import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { creditBalanceSchema, profileSchema, type Profile } from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin,
  nativeTracking,
} from "@lehno/tokens";
import {
  Avatar, Banner, Button, Card, CreditIndicator, Icon, LoadingState, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { estActive } from "@lehno/contracts";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { sectionsDeMoi } from "../../lib/navigation.js";

/* Moi — §3.17.
 *
 * L'ONGLET NE DISPARAÎT PAS QUAND SES SECTIONS SE FERMENT. Ses quatre surfaces
 * publiques suivent chacune un drapeau et peuvent toutes s'éteindre — mais ce
 * qui reste n'est pas rien : mon nom, mon adresse publique, mon solde. Ce sont
 * les choses qu'on vient voir le plus souvent, et aucune ne suit un drapeau.
 * Au lancement l'onglet se réduit donc à cela, et il tient debout.
 *
 * LE SOLDE VIT ICI, PAS DANS LES RÉGLAGES. On l'ouvre plusieurs fois par
 * semaine ; les réglages se consultent deux fois par an. Ranger ce qu'on
 * consulte le plus dans ce qu'on ouvre le moins était une erreur de rangement —
 * la mienne, jusqu'à ce que la maquette la corrige.
 */
export default function Moi() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();

  const [profil, setProfil] = useState<Profile | null>(null);
  const [solde, setSolde] = useState<number | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const [brutProfil, brutCredits] = await Promise.all([
        appel<unknown>("/me/profile"),
        appel<unknown>("/me/credits"),
      ]);
      setProfil(profileSchema.parse(brutProfil));
      setSolde(creditBalanceSchema.parse(brutCredits).balance);
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  /* Au RETOUR, pas seulement à l'arrivée : on revient ici après avoir dépensé
     un crédit ou changé son pseudo, et l'écran doit montrer l'état d'après. */
  useFocusEffect(useCallback(() => { void charge(); }, [charge]));

  if (echec && !profil) {
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

  if (!profil) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  if (sectionsDeMoi(actives).length) {
    /* Réservé : le Mur, les listes, les mots reçus et les réservations
       arrivent avec leurs écrans. Chacune suit son drapeau, et toutes sont
       éteintes au lancement — l'onglet se réduit alors à son socle, ce qui est
       le cas NOMINAL et non une variante appauvrie. */
  }

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={[styles.page, {
        paddingTop: insets.top + nativeSpace[20],
        paddingBottom: insets.bottom + nativeSpace[24],
      }]}
    >
      {echec ? (
        <View style={{ marginBottom: nativeSpace[12] }}>
          <Banner intent="error">{echec}</Banner>
        </View>
      ) : null}

      {/* L'identité mène au profil : c'est là qu'on la corrige, et l'adresse
          publique se lit ici parce que c'est ce qu'on donne aux autres. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => routeur.push("/(app)/profil")}
        style={styles.identite}
      >
        <Avatar name={profil.displayName ?? profil.username} size={54} />
        <View style={styles.qui}>
          <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>
            {profil.displayName ?? profil.username}
          </Text>
          <Text style={[styles.adresse, { color: couleurs.textSecondary }]} numberOfLines={1}>
            {t.pseudoAdresse(profil.username)}
          </Text>
        </View>
        <Icon name="chevron-right" size={16} color={couleurs.textMention} />
      </Pressable>

      {solde !== null ? (
        <Card surface="panel" padding={15} radius="lg">
          <View style={styles.soldeLigne}>
            <View style={styles.pleine}>
              <Text style={[styles.mention, { color: couleurs.textSecondary }]}>
                {t.moiSolde}
              </Text>
              <CreditIndicator label={t.moiSolde} balance={solde} variant="solde" />
            </View>
            <Button onPress={() => routeur.push("/(app)/recharge")}>{t.moiRecharger}</Button>
          </View>
        </Card>
      ) : null}

      {/* LE SECOND CHEMIN VERS DES CRÉDITS, et le seul qui n'en coûte pas. Il
          suit son drapeau ici comme sur §3.9 : `referral` est ouvert au
          lancement, et il compte d'autant plus quand l'achat passe par un
          versement manuel. */}
      {estActive(actives, "referral") ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => routeur.push("/(app)/parrainage")}
          style={[styles.rang, { borderTopColor: couleurs.borderHairline }]}
        >
          <Icon name="user-plus" size={17} color={couleurs.textMention} />
          <Text style={[styles.libelle, { color: couleurs.textBody }]} numberOfLines={1}>
            {t.parrainageTitre}
          </Text>
          <Icon name="chevron-right" size={15} color={couleurs.textMention} />
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: nativeSpace[16] },
  identite: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    minHeight: nativeTouchMin, marginBottom: nativeSpace[20],
  },
  qui: { flex: 1, minWidth: 0 },
  nom: {
    fontFamily: nativeFont.displayRegular, fontSize: 21,
    letterSpacing: nativeLetterSpacing(21, nativeTracking.display),
  },
  adresse: { fontFamily: nativeFont.bodyRegular, fontSize: 13, marginTop: nativeSpace[2] },
  soldeLigne: { flexDirection: "row", alignItems: "flex-end", gap: nativeSpace[12] },
  pleine: { flex: 1 },
  mention: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5 },
  rang: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[10],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
    marginTop: nativeSpace[20], borderTopWidth: nativeBorder.width,
  },
  libelle: { flex: 1, fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
});

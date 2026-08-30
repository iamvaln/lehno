import { useCallback, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  creditBalanceSchema, profileSchema, receivedWishListSchema, wallSchema,
  wishlistListSchema, wishLinkSchema,
  type Profile, type Wall, type WishLink,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin,
  nativeTracking,
} from "@lehno/tokens";
import {
  Avatar, Banner, Button, Card, CreditIndicator, Icon, LoadingState, SectionLabel,
  useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { estActive } from "@lehno/contracts";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { dateCourte } from "../../lib/carnet.js";
import {
  adresseAPartager, etatDuLien, etatDuMur, montreCeQuiRevient, montreLaVitrine,
} from "../../lib/vitrine.js";

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
  const [mur, setMur] = useState<Wall | null>(null);
  const [lien, setLien] = useState<WishLink | null>(null);
  const [listes, setListes] = useState<number | null>(null);
  const [mots, setMots] = useState<number | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const [brutProfil, brutCredits] = await Promise.all([
        appel<unknown>("/me/profile"),
        appel<unknown>("/me/credits"),
      ]);
      setProfil(profileSchema.parse(brutProfil));
      setSolde(creditBalanceSchema.parse(brutCredits).balance);

      /* CHAQUE SURFACE NE SE DEMANDE QUE SI SON DRAPEAU TIENT. Appeler une
         route que le serveur a fermée rendrait un 404 qu'on afficherait comme
         une panne — et l'écran s'ouvrirait en rouge sur un compte parfaitement
         sain. Les échecs individuels ne renversent rien non plus : une surface
         qu'on n'a pas su lire se tait, les autres restent. */
      if (estActive(actives, "wall")) {
        try {
          setMur(wallSchema.parse(await appel<unknown>("/me/wall")));
        } catch { /* La carte du Mur ne paraît pas, le reste tient. */ }
      }
      if (estActive(actives, "wishes")) {
        try {
          setLien(wishLinkSchema.parse(await appel<unknown>("/me/wall/wish-link")));
        } catch { /* Aucun lien ouvert : c'est un état, pas une panne. */ }
        try {
          setMots(receivedWishListSchema.parse(
            await appel<unknown>("/me/received-wishes"),
          ).length);
        } catch { /* Le décompte se tait plutôt que d'annoncer zéro à tort. */ }
      }
      if (estActive(actives, "wishlist.own")) {
        try {
          setListes(wishlistListSchema.parse(await appel<unknown>("/me/wishlists")).length);
        } catch { /* Idem. */ }
      }
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

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const adresseDuMur = mur ? adresseAPartager(mur) : null;
  const lienOuvert = lien ? etatDuLien(lien, aujourdhui) === "ouvert" : false;

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

      {/* CE QUE VOUS MONTREZ DE VOUS. Le titre disparaît avec ses surfaces : un
          intertitre sans contenu annonce ce qui ne vient pas. */}
      {montreLaVitrine(actives) ? (
        <View style={styles.groupe}>
          <Text style={[styles.sous, { color: couleurs.textSecondary }]}>{t.moiSous}</Text>
          <SectionLabel>{t.moiVitrine}</SectionLabel>

          {/* LE MUR SE PARTAGE, ET SEULEMENT S'IL RÉPOND. `publicUrl` existe
              même éteint — c'est l'adresse qu'il AURA — et la proposer alors
              enverrait des gens sur une page qui refuse. Éteint, la carte dit
              son état et rien de plus : le publier demande son écran, qui
              n'est pas porté. */}
          {mur ? (
            <Card surface="panel" padding={13} radius="lg" style={styles.carte}>
              <View style={styles.ligne}>
                <Icon name="globe" size={17} color={couleurs.textMention} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => routeur.push("/(app)/monmur")}
                  style={styles.pleine}
                >
                  <Text style={[styles.surfaceTitre, { color: couleurs.textBody }]}>
                    {t.moiMonMur}
                  </Text>
                  <Text style={[styles.mention, { color: couleurs.textMention }]}>
                    {etatDuMur(mur) === "publie" ? t.moiMurVisible : t.moiMurDesactive}
                  </Text>
                </Pressable>
                {adresseDuMur ? (
                  <Button
                    variant="text"
                    icon="send"
                    onPress={() => void Share.share({ message: adresseDuMur })}
                  >
                    {t.moiPartager}
                  </Button>
                ) : null}
              </View>
            </Card>
          ) : null}

          {/* LES WISHLISTS : le décompte se lit, l'écran attend §3.29. */}
          {listes !== null ? (
            <Card surface="panel" padding={13} radius="lg" style={styles.carte}>
              <View style={styles.ligne}>
                <Icon name="gift" size={17} color={couleurs.textMention} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => routeur.push("/(app)/listes")}
                  style={styles.pleine}
                >
                  <Text style={[styles.surfaceTitre, { color: couleurs.textBody }]}>
                    {t.moiListes}
                  </Text>
                  <Text style={[styles.mention, { color: couleurs.textMention }]}>
                    {listes === 0 ? t.moiListesAucune
                      : listes === 1 ? t.moiListesUne : t.moiListesN(listes)}
                  </Text>
                </Pressable>
              </View>
            </Card>
          ) : null}

          {/* LE LIEN DE VŒUX. Sa date vient de `closesOn`, et le jour de
              fermeture est INCLUS — « jusqu'au 3 » qui fermerait le 3 au matin
              serait une promesse rompue d'un jour. */}
          {lien ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void Share.share({ message: lien.url })}
              style={[styles.rang, { borderTopColor: couleurs.borderHairline }]}
            >
              <Icon name="link" size={17} color={couleurs.textMention} />
              <Text style={[styles.libelle, { color: couleurs.textBody }]} numberOfLines={1}>
                {t.moiLienVoeux}
              </Text>
              <Text style={[styles.valeur, { color: couleurs.textMention }]}>
                {lienOuvert
                  ? t.moiLienVoeuxOuvert(dateCourte(lien.closesOn, langue))
                  : t.moiLienVoeuxFerme}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* CE QUI EN REVIENT — ce qu'on attend, par opposition à ce qu'on règle. */}
      {montreCeQuiRevient(actives) ? (
        <View style={styles.groupe}>
          <SectionLabel>{t.moiRetour}</SectionLabel>
          {/* IL MÈNE AU SAS, PAS AU MUR. Les mots reçus restent privés — « le
              Mur n'a pas de livre d'or » — et ce qu'on en fait se décide en
              §3.8, avec « Retenir » et « Écarter ». */}
          {mots !== null ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => routeur.push("/(app)/valider")}
              style={[styles.rang, { borderTopColor: couleurs.borderHairline }]}
            >
              <Icon name="mail" size={17} color={couleurs.textMention} />
              <Text style={[styles.libelle, { color: couleurs.textBody }]} numberOfLines={1}>
                {t.moiMotsRecus}
              </Text>
              <Text style={[styles.valeur, { color: couleurs.textMention }]}>
                {mots === 0 ? t.moiMotsAucun : t.moiMotsN(mots)}
              </Text>
              <Icon name="chevron-right" size={15} color={couleurs.textMention} />
            </Pressable>
          ) : null}
          {estActive(actives, "reservation") ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => routeur.push("/(app)/reservations")}
              style={[styles.rang, { borderTopColor: couleurs.borderHairline }]}
            >
              <Icon name="bookmark" size={17} color={couleurs.textMention} />
              <Text style={[styles.libelle, { color: couleurs.textBody }]} numberOfLines={1}>
                {t.moiReservations}
              </Text>
              <Icon name="chevron-right" size={15} color={couleurs.textMention} />
            </Pressable>
          ) : null}
        </View>
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
  mention: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5 },
  rang: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[10],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
    marginTop: nativeSpace[20], borderTopWidth: nativeBorder.width,
  },
  libelle: { flex: 1, fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  groupe: { marginTop: nativeSpace[24] },
  sous: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginBottom: nativeSpace[10] },
  carte: { marginTop: nativeSpace[8] },
  ligne: { flexDirection: "row", alignItems: "center", gap: nativeSpace[10] },
  pleine: { flex: 1, minWidth: 0 },
  surfaceTitre: { fontFamily: nativeFont.displayMedium, fontSize: 16.5 },
  valeur: { fontFamily: nativeFont.bodyRegular, fontSize: 13 },
});

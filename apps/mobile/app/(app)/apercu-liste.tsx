import { useCallback, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  sharedWishlistSchema, wishlistShareSchema,
  type SharedWishlist, type WishlistShare,
} from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, Card, ConfirmSheet, Icon, LoadingState, Tag, Toast, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, appelPublic, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { ecranEteint } from "../../lib/navigation.js";
import { EcranFerme } from "../../composants/EcranFerme.js";
import {
  apercuSansSouhait, etatDuSouhaitMontre, quandDeLaListe, souhaitsMontres,
} from "../../lib/listes.js";

/* L'aperçu d'une wishlist partagée — §3.29, juste avant l'envoi.
 *
 * « ON NE DIFFUSE PAS UNE PAGE QU'ON N'A PAS VUE. » L'écran des listes ouvrait
 * la feuille de partage du système sans jamais montrer la page ; on envoyait
 * donc une adresse sans savoir ce qu'elle contient.
 *
 * IL LIT LA VRAIE PAGE — `/public/wishlists/{token}`, celle que le serveur sert
 * aux visiteurs — et non mes propres souhaits remis en forme. Deux vérités
 * finiraient par diverger, et celle de l'écran flatterait : elle montrerait ce
 * que je crois avoir exposé plutôt que ce qui l'est. C'est là qu'on découvre
 * qu'une liste de sept souhaits tous privés s'ouvre sur rien.
 *
 * DEMANDER L'APERÇU CRÉE LE LIEN, et c'est assumé : `GET /me/wishlists/:id/share`
 * est idempotent — « rouvrir la feuille de partage rend le même jeton, sinon
 * l'adresse déjà collée dans un groupe cesserait de valoir ». Regarder sa page
 * ne fabrique donc pas une seconde adresse, et la révocation reste offerte ici
 * même pour celui qui a ouvert l'aperçu sans vouloir partager.
 */
export default function ApercuDeLaListe() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();
  /* UNE ROUTE RESTE UNE ROUTE. La navigation ne propose plus cet écran
     quand son drapeau est éteint, mais un lien profond l'atteint encore :
     il se garde donc lui-même plutôt que de compter sur celui qui l'ouvre. */
  const eteint = ecranEteint("listes", actives);
  /* L'IDENTIFIANT VIENT DE LA NAVIGATION, DONC DE N'IMPORTE OÙ. Un lien profond
     peut poser ici l'identifiant de la liste d'un autre. On ne le vérifie pas
     nous-mêmes — on ne saurait pas : c'est `/me/wishlists/:id/share` qui refuse,
     parce qu'il ne cherche que sous le compte du demandeur. L'écran s'en tient
     donc à afficher l'échec plutôt qu'à inventer une garde qui mentirait.

     Ce qu'on ne fait SURTOUT PAS, c'est accepter une adresse en paramètre :
     l'aperçu du Mur l'a fait, et n'importe qui pouvait faire ouvrir l'adresse
     de son choix par l'application. L'adresse vient du serveur, toujours. */
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [partage, setPartage] = useState<WishlistShare | null>(null);
  const [page, setPage] = useState<SharedWishlist | null>(null);
  const [confirme, setConfirme] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    if (!id) return;
    try {
      const lien = wishlistShareSchema.parse(
        await appel<unknown>(`/me/wishlists/${id}/share`),
      );
      setPartage(lien);
      /* `appelPublic` et non `appel` : cette page se sert SANS COMPTE, et son
         autorisation tient au jeton du lien. Y joindre le jeton de session
         laisserait croire que l'aperçu voit plus qu'un visiteur — et le jour où
         le serveur en tiendrait compte, l'aperçu cesserait de dire vrai. */
      setPage(sharedWishlistSchema.parse(
        await appelPublic<unknown>(`/public/wishlists/${lien.token}`),
      ));
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [id, langue]);

  useFocusEffect(useCallback(() => { if (!eteint) void charge(); }, [charge, eteint]));

  const revoque = async (): Promise<void> => {
    if (!id) return;
    setConfirme(false);
    try {
      await appel<unknown>(`/me/wishlists/${id}/share`, { method: "DELETE" });
      setAccuse(t.listeRevoqueFait);
      /* On revient plutôt que de rester : la page qu'on montrait n'existe plus,
         et recharger ici RECRÉERAIT le lien qu'on vient de révoquer — le GET
         qui l'obtient est celui qui l'ouvre. */
      routeur.back();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  if (eteint) return <EcranFerme />;

  const entete = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.retour}
      onPress={() => routeur.back()}
      style={styles.retour}
    >
      <Icon name="chevron-left" size={20} color={couleurs.textBody} />
    </Pressable>
  );

  if (echec && page === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[8] }]}>
        {entete}
        <Banner intent="error">{echec}</Banner>
        <View style={{ marginTop: nativeSpace[12] }}>
          <Button variant="outline" full icon="refresh-cw" onPress={() => void charge()}>
            {t.maintReessayer}
          </Button>
        </View>
      </View>
    );
  }

  if (page === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  const souhaits = souhaitsMontres(page);

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }}>
      <ScrollView
        contentContainerStyle={[styles.page, {
          paddingTop: insets.top + nativeSpace[8],
          paddingBottom: insets.bottom + nativeSpace[24],
        }]}
      >
        {entete}

        <Text style={[styles.grandTitre, { color: couleurs.textBody }]}>
          {t.listeApercu}
        </Text>

        {echec ? (
          <View style={{ marginTop: nativeSpace[12] }}>
            <Banner intent="error">{echec}</Banner>
          </View>
        ) : null}

        {page.state === "revoked" ? (
          /* « Un lien révoqué : le serveur rend un état explicite que la page
             traduit en message, plutôt qu'une absence sèche. » On le montre tel
             quel — c'est exactement ce que lira quelqu'un à qui l'adresse a
             déjà été envoyée. */
          <View style={{ marginTop: nativeSpace[16] }}>
            <Banner intent="info">{t.pubRevoque}</Banner>
          </View>
        ) : (
          <>
            <Card surface="panel" padding={15} radius="lg" style={styles.carte}>
              <View style={styles.entete}>
                <View style={styles.pleine}>
                  <Text style={[styles.titre, { color: couleurs.textBody }]} numberOfLines={1}>
                    {t.pubListeTitre(page.ownerFirstName)}
                  </Text>
                  <Text style={[styles.mention, { color: couleurs.textMention }]}>
                    {t.pubListeQuand(
                      quandDeLaListe(page.occasionDate, langue) ?? t.listeSansDate,
                    )}
                  </Text>
                </View>
                {/* L'ACCUEIL DES RÉSERVATIONS SE LIT AU SERVEUR, jamais d'une
                    comparaison de dates faite ici : deux fuseaux, deux versions
                    du parc, deux réponses. */}
                {page.acceptsReservations ? null : <Tag tone="quiet">{t.occPassee}</Tag>}
              </View>

              {apercuSansSouhait(page) ? (
                /* LE PIÈGE QUE CET ÉCRAN EXISTE POUR ATTRAPER. Le compte affiché
                   sur la liste compte TOUS mes souhaits ; la page publique n'en
                   montre que les publics. Sans ce mot, on envoie une adresse qui
                   s'ouvre sur du vide, et personne ne le dit jamais. */
                <View style={{ marginTop: nativeSpace[12] }}>
                  <Banner intent="warning">{t.listeApercuRien}</Banner>
                </View>
              ) : (
                <View style={{ marginTop: nativeSpace[8] }}>
                  {souhaits.map((s, i) => {
                    const etat = etatDuSouhaitMontre(s);
                    return (
                      <View
                        key={s.id}
                        style={[styles.rang, i ? {
                          borderTopWidth: nativeBorder.width,
                          borderTopColor: couleurs.borderHairline,
                        } : null]}
                      >
                        <Text
                          style={[styles.souhait, { color: couleurs.textBody }]}
                          numberOfLines={1}
                        >
                          {s.label}
                        </Text>
                        {/* « Réservé OUI, par qui JAMAIS » : la forme publique ne
                            nomme personne, et l'aperçu n'a donc rien à masquer. */}
                        {etat ? (
                          <Tag tone="quiet">
                            {etat === "offert" ? t.reservDejaOffert : t.pubListeReserve}
                          </Tag>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>

            {/* L'ADRESSE VIENT DU SERVEUR, jamais composée ici : « le domaine
                public change — préproduction, essai — et deux versions du parc
                en fabriqueraient deux différentes ». */}
            {partage ? (
              <View style={{ marginTop: nativeSpace[16] }}>
                <Button
                  full
                  icon="send"
                  onPress={() => { void Share.share({ message: partage.url }); }}
                >
                  {t.moiPartager}
                </Button>
                <View style={{ marginTop: nativeSpace[8] }}>
                  <Button
                    full
                    variant="destructiveOutline"
                    onPress={() => setConfirme(true)}
                  >
                    {t.listeRevoquer}
                  </Button>
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* RÉVOQUER NE SE DÉFAIT PAS : le contrat n'offre pas de réactivation, il
          faudra un lien neuf, et celui qui circule déjà cessera de valoir. Un
          geste irréversible passe par une confirmation. */}
      {confirme ? (
        <ConfirmSheet
          titre={t.listeRevoquer}
          texte={t.collecteRevoqueTexte}
          confirmer={t.listeRevoquer}
          annuler={t.annuler}
          destructif
          insetBas={insets.bottom}
          onConfirmer={() => { void revoque(); }}
          onAnnuler={() => setConfirme(false)}
        />
      ) : null}

      {accuse ? (
        <Toast intent="success" insetBas={insets.bottom} onDismiss={() => setAccuse(null)}>
          {accuse}
        </Toast>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: nativeSpace[16] },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  grandTitre: { fontFamily: nativeFont.displayMedium, fontSize: 21 },
  carte: { marginTop: nativeSpace[16] },
  entete: { flexDirection: "row", alignItems: "center", gap: nativeSpace[10] },
  pleine: { flex: 1, minWidth: 0 },
  titre: { fontFamily: nativeFont.displayMedium, fontSize: 17 },
  mention: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[4] },
  rang: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[10],
    paddingVertical: nativeSpace[10], minHeight: nativeTouchMin,
  },
  souhait: { flex: 1, minWidth: 0, fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
});

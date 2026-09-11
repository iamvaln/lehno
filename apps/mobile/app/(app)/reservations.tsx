import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { myReservationListSchema, type MyReservation } from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, EmptyState, Icon, LoadingState, ScreenHeader, Toast, useCouleurs
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { dateCourte } from "../../lib/carnet.js";
import { reservationsQuiTiennent } from "../../lib/vitrine.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { ecranEteint } from "../../lib/navigation.js";
import { EcranFerme } from "../../composants/EcranFerme.js";

/* Mes réservations — §3.27.
 *
 * CE QUE J'AI PROMIS AUX AUTRES, pas ce qu'on m'a promis. On vient ici pour se
 * rappeler ce qu'on doit acheter, et pour quand — donc la plus proche d'abord.
 *
 * L'IDENTITÉ EST UNE DONNÉE, pas une supposition : `showIdentity` dit si l'on
 * s'est fait connaître de la personne. Le deviner d'un autre champ ferait dire
 * à l'écran l'inverse de ce qu'on a choisi au moment de réserver.
 *
 * UN SEUL GESTE, ET C'EST « LIBÉRER ». J'avais écrit ici que le contrat n'en
 * servait aucun des trois. C'était faux pour celui-là :
 * `DELETE /public/owner-wishes/{id}/reserve` dit en toutes lettres que
 * « l'identité vient du jeton de visite OU DE LA SESSION ». Le chemin est
 * public parce qu'un visiteur sans compte doit pouvoir se dédire ; il accepte
 * la session tout autant, et `wishId` est servi ici.
 *
 * Le laisser de côté avait un coût réel : un cadeau réservé par erreur, ou
 * qu'on ne peut plus offrir, restait bloqué jusqu'à la date — et la personne
 * ne recevait rien. C'est précisément ce que la route existe pour éviter.
 *
 * LES DEUX AUTRES RESTENT ABSENTS, eux pour de bon. « Marquer comme offert »
 * n'a aucune route — c'est le PROPRIÉTAIRE qui marque reçu, pas celui qui
 * offre. Et l'état « Retiré par son propriétaire » n'a aucun champ :
 * `myReservationSchema` ne le porte pas. Les poser ferait deux commandes qui
 * échouent, sur des cadeaux que d'autres attendent.
 */
export default function Reservations() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();
  /* UNE ROUTE RESTE UNE ROUTE. La navigation ne propose plus cet écran
     quand son drapeau est éteint, mais un lien profond l'atteint encore :
     il se garde donc lui-même plutôt que de compter sur celui qui l'ouvre. */
  const eteint = ecranEteint("reservations", actives);

  const [reservations, setReservations] = useState<MyReservation[] | null>(null);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      setReservations(myReservationListSchema.parse(await appel<unknown>("/me/reservations")));
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useEffect(() => { if (!eteint) void charge(); }, [charge, eteint]);

  /* L'EN-TÊTE VIT DANS TOUS LES ÉTATS, pas seulement dans le nominal :
     l'écran de panne et celui de chargement le perdaient, et avec lui le
     seul moyen visible de revenir. `entetes.test.ts` le vérifie. */
  const entete = (
    <ScreenHeader titre={t.enteteReservations} retour={t.retour} onRetour={() => routeur.back()} />
  );

  if (echec && reservations === null) {
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

  if (reservations === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[8] }]}>
        {entete}
        <LoadingState variant="liste" rows={4} title={t.chargement} />
      </View>
    );
  }

  if (!reservations.length) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[8] }]}>
        {entete}
        {/* L'EN-TÊTE RESTE EN HAUT ; seul le vide se centre. Centrés
            ensemble, les deux descendaient au milieu de l'écran et la
            flèche flottait loin du bord. */}
        <View style={styles.aumilieu}>
          <EmptyState
            illustration="souhait-reserve"
            title={t.reservVideTitre}
            text={t.reservVideTexte}
          />
        </View>
      </View>
    );
  }

  /* 404 VAUT SUCCÈS. La route rend 404 « quand rien ne correspond, jamais un
     refus explicite » — pour ne pas confirmer à un curieux qu'une réservation
     existe. Ici, cela veut dire qu'elle n'est plus à nous : la retirer de la
     liste est la bonne réponse, pas afficher une panne.

     On retire de la liste AVANT la réponse : le geste est rare et la latence
     se voit. Si l'appel échoue autrement, on remet — et on le dit. */
  const libere = async (r: MyReservation): Promise<void> => {
    setReservations((v) => (v ?? []).filter((x) => x.id !== r.id));
    try {
      await appel<unknown>(`/public/owner-wishes/${r.wishId}/reserve`, {
        method: "DELETE", gouvernee: true,
      });
      setAccuse(t.reservLibereFait);
    } catch (e) {
      const code = e instanceof ErreurDApi ? e.enveloppe?.code : null;
      if (code === "not_found") { setAccuse(t.reservLibereFait); return; }
      setReservations((v) => [...(v ?? []), r]);
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  if (eteint) return <EcranFerme />;

  return (
    /* L'ACCUSÉ EST FRÈRE DU DÉFILEMENT, jamais son enfant : posé en absolu, il
       s'ancre au bas de sa boîte parente — le CONTENU s'il vit dedans, donc
       hors champ dès que la liste dépasse un écran.
       `surcouches.test.ts` le vérifie. */
    <View style={[styles.ecran, { backgroundColor: couleurs.surfacePage }]}>
    <ScrollView
      style={styles.ecran}
      contentContainerStyle={[styles.page, {
        paddingTop: insets.top + nativeSpace[8],
        paddingBottom: insets.bottom + nativeSpace[24],
      }]}
    >
      {entete}
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
              {/* SANS OCCASION, on ne met pas de point milieu devant le vide :
                  une liste qui ne vise aucune date n'a rien à annoncer, et
                  « Awa · » se lirait comme une date qui n'a pas chargé. */}
              {r.occurrenceDate === null
                ? r.ownerDisplayName
                : `${r.ownerDisplayName} · ${dateCourte(r.occurrenceDate, langue)}`}
            </Text>
          </View>
          {/* `showIdentity` est une DONNÉE : elle dit si l'on s'est fait
              connaître. La déduire ferait dire à l'écran l'inverse de ce qu'on
              a choisi au moment de réserver. */}
          {r.showIdentity ? null : (
            <Icon name="eye" size={15} color={couleurs.textMention} />
          )}
          {/* En bouton texte, discret : rendre un cadeau est un geste rare, et
              une commande trop visible sur chaque rang inviterait à le défaire
              par mégarde. */}
          <Button variant="text" onPress={() => void libere(r)}>{t.reservLiberer}</Button>
        </View>
      ))}
    </ScrollView>

      {accuse ? (
        <Toast intent="success" insetBas={insets.bottom} onDismiss={() => setAccuse(null)}>
          {accuse}
        </Toast>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  page: { flexGrow: 1, paddingHorizontal: nativeSpace[16] },
  // Enfant de la page depuis que l'en-tête le précède : sans `flex`, il
  // n'occupe que sa hauteur propre et n'a plus rien à centrer.
  aumilieu: { flex: 1, justifyContent: "center" },
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

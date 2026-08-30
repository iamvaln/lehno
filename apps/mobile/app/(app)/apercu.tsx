import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { publicWallSchema, type PublicWall } from "@lehno/contracts";
import {
  nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Banner, Button, Icon, LoadingState, SectionLabel, Tag, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { accepteDesVoeux, anniversaireSansAnnee, pageVide } from "../../lib/apercu.js";

/* L'aperçu de mon Mur — §3.12, vu depuis l'application.
 *
 * IL RÉPOND À UNE SEULE QUESTION : qu'est-ce que l'autre verra ? On se la pose
 * juste avant de partager, et c'est le moment où l'on découvre qu'on expose
 * plus — ou moins — qu'on ne croyait.
 *
 * IL LIT `/me/wall/preview`, qui rend exactement ce qu'un visiteur reçoit.
 * Recomposer l'aperçu depuis mes propres réglages donnerait deux vérités, et
 * celle de l'écran finirait par flatter : elle montrerait ce que je crois avoir
 * exposé plutôt que ce qui l'est.
 *
 * CE N'EST PAS UNE MAQUETTE DE LA PAGE, et c'est délibéré. Le kit web dessine
 * `WallPage` avec ses propres phrases — « Bienvenue chez… », « Mon
 * anniversaire, c'est le… » — mais ce dictionnaire-là est celui du BANC
 * D'ESSAI, et il fige quatre valeurs. Les recopier ici les figerait à leur
 * tour, et l'aperçu dériverait de la page à la première retouche. On montre
 * donc l'INVENTAIRE de ce qui est exposé, pas une imitation de la mise en page.
 *
 * Pour voir la page telle qu'elle est, il y a son adresse — c'est elle qui dit
 * la vérité, et non une copie qu'on tiendrait à jour à la main.
 */
export default function Apercu() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { url } = useLocalSearchParams<{ url?: string }>();

  const [mur, setMur] = useState<PublicWall | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      setMur(publicWallSchema.parse(await appel<unknown>("/me/wall/preview")));
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

  if (echec && !mur) {
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

  if (!mur) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[8] }]}>
        {retour}
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  const anniversaire = mur.birthday ? anniversaireSansAnnee(mur.birthday, langue) : null;

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={[styles.page, {
        paddingTop: insets.top + nativeSpace[8],
        paddingBottom: insets.bottom + nativeSpace[24],
      }]}
    >
      {retour}

      <Text style={[styles.titre, { color: couleurs.textBody }]} accessibilityRole="header">
        {t.murPrivApercu}
      </Text>

      {/* CE QUE LA PAGE NE DIT RIEN DE SOI est une information, pas une panne :
          on s'apprête à partager une adresse qui ne montre rien. */}
      {pageVide(mur) ? (
        <Text style={[styles.rien, { color: couleurs.textMention }]}>
          {t.moiMurDesactive}
        </Text>
      ) : null}

      <View style={styles.bloc}>
        <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>
          {mur.displayName}
        </Text>
        {mur.welcomeMessage ? (
          <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
            {mur.welcomeMessage}
          </Text>
        ) : null}
      </View>

      {/* L'ANNIVERSAIRE SANS SON ANNÉE — le contrat rend « MM-DD », et le dit :
          « le Mur annonce un anniversaire, pas une date de naissance ;
          l'année dirait l'âge à tout visiteur ». */}
      {anniversaire ? (
        <View style={styles.bloc}>
          <SectionLabel>{t.profilNaissance}</SectionLabel>
          <Text style={[styles.texte, { color: couleurs.textSecondary }]}>{anniversaire}</Text>
        </View>
      ) : null}

      {mur.interests.length ? (
        <View style={styles.bloc}>
          {/* Le libellé est celui du VISITEUR — « Ce que Valentine aime » —
              et c'est bien ce qu'on veut voir dans un aperçu : la page telle
              qu'elle est lue, pas telle qu'on la règle. */}
          <SectionLabel>{t.murGoutsLabel(mur.displayName)}</SectionLabel>
          <View style={styles.tags}>
            {mur.interests.map((i, rang) => (
              <Tag key={`${i.kind}-${rang}`}>{i.value}</Tag>
            ))}
          </View>
        </View>
      ) : null}

      {/* LE DÉPÔT DE VŒUX EST RÉSOLU PAR LE SERVEUR : nul « quand il n'y a pas
          d'occasion, quand la fenêtre est fermée, ou quand le drapeau est
          éteint. Le serveur résout les trois : un client n'a aucune règle à
          connaître, et ne peut donc pas proposer un bouton qui mènerait à un
          404. » On lit le jeton, on ne recompose rien. */}
      {accepteDesVoeux(mur) ? (
        <View style={styles.bloc}>
          {/* La SECTION dit tout : le Mur accepte des mots. Y ajouter une
              phrase demanderait un libellé que la copie ne porte pas, et
              l'écrire serait rédiger à la place de qui rédige. */}
          <SectionLabel>{t.moiLienVoeux}</SectionLabel>
        </View>
      ) : null}

      {/* LA PAGE ELLE-MÊME dit la vérité, et non cette liste : on l'ouvre pour
          la voir telle qu'elle est. L'adresse vient de l'écran d'où l'on
          arrive — le Mur la sert déjà, et la recomposer ici en ferait une
          seconde. */}
      {url ? (
        <View style={styles.pied}>
          <Button full variant="outline" icon="external-link" onPress={() => void Linking.openURL(url)}>
            {t.murPrivVoir}
          </Button>
        </View>
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
    fontFamily: nativeFont.displayMedium, fontSize: 22, marginTop: nativeSpace[8],
    letterSpacing: nativeLetterSpacing(22, nativeTracking.display),
  },
  rien: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginTop: nativeSpace[8] },
  bloc: { marginTop: nativeSpace[20] },
  nom: { fontFamily: nativeFont.displayMedium, fontSize: 19 },
  texte: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5, marginTop: nativeSpace[6] },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: nativeSpace[6], marginTop: nativeSpace[8] },
  pied: { marginTop: nativeSpace[28] },
});

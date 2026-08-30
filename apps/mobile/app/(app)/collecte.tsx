import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  collectionLinkSchema, personSchema, type CollectionLink, type Person,
} from "@lehno/contracts";
import { nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, Card, Icon, LoadingState, Tag, Toast, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { corpsDeCreation, lienVivantPour } from "../../lib/collecte.js";

/* Le lien de collecte — §3.20.
 *
 * « Envoyez ce lien : ce qui en revient passe par votre validation avant
 * d'entrer dans la fiche. » C'est ce qui rend le sas de §3.8 utile : sans lien,
 * rien n'arrive.
 *
 * PAS DE BOUTON « PARTAGER », ET C'EST UN MANQUE DU CONTRAT, pas un choix.
 * `collectionLinkSchema` porte un `token` et aucune URL — là où
 * `wishlistShareSchema` sert l'adresse complète, avec cette raison : « le
 * client ne la reconstitue pas ; le domaine public change — préproduction,
 * essai — et deux versions du parc en fabriqueraient deux différentes ». Deux
 * mécanismes de partage, un seul sert son adresse.
 *
 * Composer `…/c/<token>` moi-même serait deviner un chemin que personne n'a
 * arrêté : le site n'a aucune route pour l'ouvrir aujourd'hui. Le bouton
 * paraîtra le jour où l'URL sera servie — une ligne à ajouter, pas un écran à
 * refaire.
 *
 * PAS DE « RÉACTIVER » NON PLUS. Le contrat n'offre que créer et révoquer : « le
 * lien est durable — pas d'expiration, seulement une révocation ». La copie
 * propose « Réactiver un lien » et se contredit deux lignes plus bas, « vous
 * pouvez en créer un autre ». C'est la seconde qui dit vrai.
 */
const listeDeLiens = collectionLinkSchema.array();

export default function Collecte() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [proche, setProche] = useState<Person | null>(null);
  const [liens, setLiens] = useState<CollectionLink[] | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    if (!id) return;
    try {
      const [brutProche, brutLiens] = await Promise.all([
        appel<unknown>(`/me/persons/${id}`),
        appel<unknown>("/me/collection-links"),
      ]);
      setProche(personSchema.parse(brutProche));
      setLiens(listeDeLiens.parse(brutLiens));
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [id, langue]);

  useFocusEffect(useCallback(() => { void charge(); }, [charge]));

  const cree = async (): Promise<void> => {
    if (!id) return;
    setEnvoi(true);
    setEchec(null);
    try {
      await appel<unknown>("/me/collection-links", {
        method: "POST",
        body: JSON.stringify(corpsDeCreation("nominatif", id)),
      });
      await charge();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  const revoque = async (lien: CollectionLink): Promise<void> => {
    setEnvoi(true);
    setEchec(null);
    try {
      await appel<unknown>(`/me/collection-links/${lien.id}`, { method: "DELETE" });
      setAccuse(t.collecteRevoqueFait);
      await charge();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

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

  if (echec && liens === null) {
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

  if (!proche || liens === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[8] }]}>
        {retour}
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  const vivant = lienVivantPour(liens, proche.id);

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }}>
      <ScrollView
        contentContainerStyle={[styles.page, {
          paddingTop: insets.top + nativeSpace[8],
          paddingBottom: insets.bottom + nativeSpace[24],
        }]}
      >
        {retour}

        <Text style={[styles.titre, { color: couleurs.textBody }]} accessibilityRole="header">
          {t.collecteTitre(proche.displayName)}
        </Text>
        <Text style={[styles.intro, { color: couleurs.textSecondary }]}>{t.collecteIntro}</Text>

        {echec ? (
          <View style={{ marginTop: nativeSpace[12] }}>
            <Banner intent="error">{echec}</Banner>
          </View>
        ) : null}

        {vivant ? (
          <Card surface="panel" padding={15} radius="lg" style={styles.carte}>
            <View style={styles.ligne}>
              <Icon name="link" size={17} color={couleurs.textMention} />
              {/* LE JETON, PAS UNE ADRESSE. Composer un lien depuis lui serait
                  deviner un chemin que personne n'a arrêté — et le site n'a
                  aucune page pour l'ouvrir. On montre ce que le serveur donne,
                  sélectionnable, et rien de plus. */}
              <Text selectable style={[styles.jeton, { color: couleurs.textBody }]}>
                {vivant.token}
              </Text>
              <Tag tone="quiet">{t.collecteEtatActif}</Tag>
            </View>
            <View style={{ marginTop: nativeSpace[12] }}>
              <Button
                full
                variant="outline"
                disabled={envoi}
                onPress={() => void revoque(vivant)}
              >
                {t.collecteRevoquer}
              </Button>
            </View>
          </Card>
        ) : (
          <>
            {/* Un lien révoqué « ne mène plus à rien » et ne se rallume pas :
                on en crée un autre, et la copie le dit elle-même. */}
            {liens.some((l) => l.personId === proche.id) ? (
              <Text style={[styles.intro, { color: couleurs.textMention }]}>
                {t.collecteRevoqueTexte}
              </Text>
            ) : null}
            <View style={styles.carte}>
              <Button full icon="link" disabled={envoi} onPress={() => void cree()}>
                {t.ficheCollecte}
              </Button>
            </View>
          </>
        )}
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
  page: { flexGrow: 1, paddingHorizontal: nativeSpace[16] },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  titre: { fontFamily: nativeFont.displayMedium, fontSize: 22, marginTop: nativeSpace[8] },
  intro: { fontFamily: nativeFont.bodyRegular, fontSize: 14, marginTop: nativeSpace[8] },
  carte: { marginTop: nativeSpace[20] },
  ligne: { flexDirection: "row", alignItems: "center", gap: nativeSpace[10] },
  jeton: { flex: 1, fontFamily: nativeFont.displayMedium, fontSize: 17 },
});

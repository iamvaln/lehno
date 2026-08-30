import { useCallback, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  occurrenceSchema, personListSchema, wishlistListSchema, wishlistShareSchema,
  type Occurrence, type Wishlist,
} from "@lehno/contracts";

/* `/me/occurrences` rend un tableau nu — comme l'écran de note le lit déjà.
   On compose donc la liste ici plutôt que d'ajouter un nom au contrat pour un
   seul appelant de plus. */
const listeDEcheances = occurrenceSchema.array();
import { nativeBorder, nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, Card, EmptyState, Icon, LoadingState, SectionLabel, Tag, Toast,
  useCouleurs,
} from "@lehno/ui-native";
import { Choix } from "../../composants/Choix.js";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { dateCourte } from "../../lib/carnet.js";
import { libelleDeLEcheance } from "../../lib/libelles.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { ecranEteint } from "../../lib/navigation.js";
import { EcranFerme } from "../../composants/EcranFerme.js";
import {
  listesRangees, occasionsOuvrables, peutPartager, resteAOffrir,
} from "../../lib/listes.js";

/* Mes wishlists — §3.29.
 *
 * UNE LISTE EST SON OCCASION. Le contrat ne lui donne pas de nom : elle porte
 * son occurrence, sa date et la nature de l'événement — « un cadeau de Noël
 * n'est pas un cadeau de mariage ».
 *
 * CE QUE LA MAQUETTE DEMANDE ET QUE LE CONTRAT NE PORTE PAS : un champ « nom
 * de la liste », une option « sans occasion », et une clôture réglable.
 * `createWishlistSchema` ne prend qu'une `occurrenceId`, obligatoire. Poser ces
 * trois champs ferait un formulaire dont la moitié se perdrait à l'envoi.
 *
 * OUVRIR UNE LISTE, C'EST CHOISIR UNE DE SES PROPRES DATES. « Ouvrir une liste
 * sur l'occasion d'un proche publierait ce que ce proche n'a jamais accepté de
 * publier » — d'où le filtre sur ses propres occurrences, et non sur toutes.
 */
export default function Listes() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();
  /* UNE ROUTE RESTE UNE ROUTE. La navigation ne propose plus cet écran
     quand son drapeau est éteint, mais un lien profond l'atteint encore :
     il se garde donc lui-même plutôt que de compter sur celui qui l'ouvre. */
  const eteint = ecranEteint("listes", actives);

  const [listes, setListes] = useState<Wishlist[] | null>(null);
  const [miennes, setMiennes] = useState<Occurrence[]>([]);
  const [ouvre, setOuvre] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const mes = wishlistListSchema.parse(await appel<unknown>("/me/wishlists"));
      setListes(mes);
      /* Mes propres échéances, pour savoir sur quoi une liste peut s'ouvrir.
         La fiche de soi est marquée `isSelf` au contrat ; on demande donc les
         occurrences de cette fiche, jamais toutes — le carnet entier ferait
         proposer d'ouvrir une liste sur l'anniversaire d'un proche. */
      const carnet = personListSchema.parse(await appel<unknown>("/me/persons?limit=100"));
      const soi = carnet.persons.find((p) => p.isSelf);
      if (soi) {
        setMiennes(listeDEcheances.parse(
          await appel<unknown>(`/me/occurrences?personId=${soi.id}&limit=100`),
        ));
      }
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useFocusEffect(useCallback(() => { if (!eteint) void charge(); }, [charge, eteint]));

  const ouvreUneListe = async (occurrenceId: string): Promise<void> => {
    setEnvoi(true);
    setEchec(null);
    try {
      await appel<unknown>("/me/wishlists", {
        method: "POST",
        body: JSON.stringify({ occurrenceId }),
      });
      setOuvre(null);
      setAccuse(t.listeNouvFait);
      await charge();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  /* L'ADRESSE VIENT DU SERVEUR, jamais composée ici : « le domaine public
     change — préproduction, essai — et deux versions du parc en fabriqueraient
     deux différentes ». */
  const partage = async (liste: Wishlist): Promise<void> => {
    try {
      const lien = wishlistShareSchema.parse(
        await appel<unknown>(`/me/wishlists/${liste.id}/share`),
      );
      await Share.share({ message: lien.url });
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  if (echec && listes === null) {
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

  if (listes === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={3} title={t.chargement} />
      </View>
    );
  }

  const ouvrables = occasionsOuvrables(miennes, listes);

  if (eteint) return <EcranFerme />;

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }}>
      <ScrollView
        contentContainerStyle={[styles.page, {
          paddingTop: insets.top + nativeSpace[8],
          paddingBottom: insets.bottom + nativeSpace[24],
        }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.retour}
          onPress={() => routeur.back()}
          style={styles.retour}
        >
          <Icon name="chevron-left" size={20} color={couleurs.textBody} />
        </Pressable>

        {echec ? (
          <View style={{ marginBottom: nativeSpace[12] }}>
            <Banner intent="error">{echec}</Banner>
          </View>
        ) : null}

        {listes.length ? (
          listesRangees(listes).map((l) => (
            <Card key={l.id} surface="panel" padding={15} radius="lg" style={styles.carte}>
              <Pressable
                accessibilityRole="button"
                onPress={() => routeur.push({
                  pathname: "/(app)/souhaits", params: { id: l.id },
                })}
                style={styles.entete}
              >
                <View style={styles.pleine}>
                  <Text style={[styles.titre, { color: couleurs.textBody }]} numberOfLines={1}>
                    {libelleDeLEcheance(
                      l.eventKind === "birthday" ? "birthday" : "other", l.eventLabel, t,
                    )}
                  </Text>
                  <Text style={[styles.mention, { color: couleurs.textMention }]}>
                    {dateCourte(l.occurrenceDate, langue)}
                  </Text>
                </View>
                {l.isArchived ? <Tag tone="quiet">{t.listeArchivee}</Tag> : null}
                <Icon name="chevron-right" size={15} color={couleurs.textMention} />
              </Pressable>

              {/* COMBIEN, jamais LESQUELS ni PAR QUI : savoir qui a réservé quoi
                  gâcherait la surprise qu'on prépare. */}
              <Text style={[styles.compte, { color: couleurs.textSecondary }]}>
                {t.listeRetenu} · {l.reservedCount} / {l.wishCount}
                {resteAOffrir(l) > 0 ? "" : ` · ${t.souhaitReserve}`}
              </Text>

              {l.isArchived ? (
                <Text style={[styles.mention, { color: couleurs.textMention }]}>
                  {t.listeArchiveeTexte}
                </Text>
              ) : null}

              {/* PARTAGER N'A DE SENS QUE VIVANTE ET REMPLIE : une archivée
                  n'accepte plus rien, une vide ferait choisir dans rien. */}
              {peutPartager(l) ? (
                <View style={{ marginTop: nativeSpace[10] }}>
                  <Button full variant="outline" icon="send" onPress={() => void partage(l)}>
                    {t.moiPartager}
                  </Button>
                </View>
              ) : null}
            </Card>
          ))
        ) : (
          <EmptyState
            illustration="souhaits-vide"
            title={t.moiListesAucune}
            text={t.listeMesDatesAucune}
          />
        )}

        {/* OUVRIR UNE LISTE : choisir une de SES dates, et rien d'autre. Une
            occasion qui porte déjà sa liste n'apparaît pas — deux listes pour
            un même anniversaire se partageraient l'une l'autre sans qu'on
            sache laquelle circule. */}
        {ouvrables.length ? (
          <View style={styles.bloc}>
            <SectionLabel>{t.listeNouvOccasion}</SectionLabel>
            <Choix
              options={ouvrables.map((o) => o.id)}
              libelle={(id) => {
                const o = ouvrables.find((x) => x.id === id);
                return o ? dateCourte(o.occurrenceDate, langue) : "—";
              }}
              valeur={ouvre}
              pose={setOuvre}
            />
            <View style={{ marginTop: nativeSpace[12] }}>
              <Button
                full
                icon="plus"
                disabled={envoi || ouvre === null}
                onPress={() => { if (ouvre) void ouvreUneListe(ouvre); }}
              >
                {t.listeCreer}
              </Button>
            </View>
          </View>
        ) : null}
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
  carte: { marginTop: nativeSpace[12] },
  entete: { flexDirection: "row", alignItems: "center", gap: nativeSpace[10] },
  pleine: { flex: 1, minWidth: 0 },
  titre: { fontFamily: nativeFont.displayMedium, fontSize: 17 },
  mention: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[4] },
  compte: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginTop: nativeSpace[8] },
  bloc: { marginTop: nativeSpace[24], borderTopWidth: nativeBorder.width, paddingTop: nativeSpace[16] },
});

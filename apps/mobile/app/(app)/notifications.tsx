import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { notificationsPageSchema, type Notification } from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, EmptyState, Icon, LoadingState, SectionLabel, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { dateCourte } from "../../lib/carnet.js";
import {
  cibleDeLaNotification, corpsDeLecture, corpsDeToutLire, estDAujourdhui,
  libelleDeLaNotification,
} from "../../lib/notifications.js";

/* Le centre de notifications — §3.13.
 *
 * « UNE NOTIFICATION MÈNE LÀ OÙ L'ON AGIT » — directement à l'écran concerné,
 * sans passer par la liste. Il n'y a donc pas d'écran de détail : une
 * notification est un chemin, pas une destination.
 *
 * ON NE DÉCOUPE JAMAIS `targetRoute`. Le contrat sert les références brutes EN
 * PLUS du chemin, précisément pour ça : « lui faire découper
 * /occurrences/<uuid> pour retrouver l'identifiant, c'est lui faire
 * réimplémenter la grammaire d'URL du serveur — le jour où elle change,
 * l'application ouvre des écrans vides sans qu'aucun test ne tombe ».
 *
 * C'est la même leçon que la faille du lien sortant, corrigée hier : une
 * chaîne servie n'est pas une instruction.
 */
export default function Notifications() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [items, setItems] = useState<Notification[] | null>(null);
  const [suite, setSuite] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const page = notificationsPageSchema.parse(await appel<unknown>("/me/notifications"));
      setItems(page.items);
      setSuite(page.nextCursor);
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useFocusEffect(useCallback(() => { void charge(); }, [charge]));

  /* LE CURSEUR, JAMAIS UN RANG. « Le centre grandit PAR LE HAUT : avec un
     offset, une notification arrivée entre deux pages décale tout ce qui suit —
     la dernière entrée de la page 1 réapparaît en tête de la page 2, et une
     autre disparaît sans être passée sous les yeux de personne. » */
  const encore = async (): Promise<void> => {
    if (!suite) return;
    try {
      const page = notificationsPageSchema.parse(
        await appel<unknown>(`/me/notifications?cursor=${encodeURIComponent(suite)}`),
      );
      setItems((v) => [...(v ?? []), ...page.items]);
      setSuite(page.nextCursor);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  const marque = async (corps: unknown): Promise<void> => {
    try {
      await appel<unknown>("/me/notifications/read", {
        method: "POST",
        body: JSON.stringify(corps),
      });
      await charge();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  /* OUVRIR UNE ENTRÉE LA LIT. « Chaque entrée renvoie directement vers l'écran
     qui permet d'agir, donc une entrée ouverte se lit seule. » */
  const ouvre = (n: Notification): void => {
    const cible = cibleDeLaNotification(n);
    if (!cible) return;
    if (!n.readAt) void marque(corpsDeLecture([n.id]));
    if (cible.sorte === "occasion") {
      routeur.push({ pathname: "/(app)/occasion", params: { occurrenceId: cible.id } });
    } else {
      routeur.push({ pathname: "/(app)/proches/[id]", params: { id: cible.id } });
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

  if (echec && items === null) {
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

  if (items === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[8] }]}>
        {retour}
        <LoadingState variant="liste" rows={5} title={t.chargement} />
      </View>
    );
  }

  /* UNE ENTRÉE QU'ON NE SAIT PAS DIRE NE S'AFFICHE PAS. Montrer
     « notification.activation_first_note » serait du vocabulaire interne servi
     à quelqu'un — pire que le silence. Le test `clesSansLibelle` nomme celles
     qui attendent une phrase. */
  const lisibles = items.filter((n) => libelleDeLaNotification(n, t) !== null);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const dujour = lisibles.filter((n) => estDAujourdhui(n, aujourdhui));
  const avant = lisibles.filter((n) => !estDAujourdhui(n, aujourdhui));

  if (!lisibles.length) {
    return (
      <View style={[styles.page, styles.aumilieu, { paddingTop: insets.top + nativeSpace[8] }]}>
        {retour}
        <EmptyState
          illustration="rien-approche"
          title={t.notifsVideTitre}
          text={t.notifsVideTexte}
        />
      </View>
    );
  }

  const entree = (n: Notification): React.ReactElement => {
    const cible = cibleDeLaNotification(n);
    const contenu = (
      <>
        <View style={styles.corps}>
          <Text
            style={[styles.texte, {
              color: n.readAt ? couleurs.textSecondary : couleurs.textBody,
            }]}
          >
            {libelleDeLaNotification(n, t)}
          </Text>
          <Text style={[styles.quand, { color: couleurs.textMention }]}>
            {dateCourte(n.notifiedAt.slice(0, 10), langue)}
          </Text>
        </View>
        {/* Pas de chevron sur une entrée inerte : la flèche promettrait un
            écran que la cible disparue ne peut plus ouvrir. */}
        {cible ? <Icon name="chevron-right" size={15} color={couleurs.textMention} /> : null}
      </>
    );

    return cible ? (
      <Pressable
        key={n.id}
        accessibilityRole="button"
        onPress={() => ouvre(n)}
        style={[styles.rang, { borderTopColor: couleurs.borderHairline }]}
      >
        {contenu}
      </Pressable>
    ) : (
      <View key={n.id} style={[styles.rang, { borderTopColor: couleurs.borderHairline }]}>
        {contenu}
      </View>
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={[styles.page, {
        paddingTop: insets.top + nativeSpace[8],
        paddingBottom: insets.bottom + nativeSpace[24],
      }]}
    >
      {retour}

      <View style={styles.entete}>
        <Text style={[styles.titre, { color: couleurs.textBody }]} accessibilityRole="header">
          {t.notifsTitre}
        </Text>
        {/* « TOUT » SE TAPE, il ne s'obtient pas par omission : un corps vide
            viderait la pastille de quelqu'un qui n'a rien lu. */}
        {lisibles.some((n) => !n.readAt) ? (
          <Button variant="text" onPress={() => void marque(corpsDeToutLire())}>
            {t.notifsToutLu}
          </Button>
        ) : null}
      </View>

      {echec ? (
        <View style={{ marginBottom: nativeSpace[12] }}>
          <Banner intent="error">{echec}</Banner>
        </View>
      ) : null}

      {dujour.length ? (
        <View style={styles.bloc}>
          <SectionLabel>{t.notifsAujourdhui}</SectionLabel>
          {dujour.map(entree)}
        </View>
      ) : null}

      {avant.length ? (
        <View style={styles.bloc}>
          <SectionLabel>{t.notifsAvant}</SectionLabel>
          {avant.map(entree)}
        </View>
      ) : null}

      {suite ? (
        <View style={{ marginTop: nativeSpace[16] }}>
          <Button full variant="text" onPress={() => void encore()}>{t.voirPlus}</Button>
        </View>
      ) : null}
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
  entete: { flexDirection: "row", alignItems: "center", gap: nativeSpace[10] },
  titre: { flex: 1, fontFamily: nativeFont.displayMedium, fontSize: 22 },
  bloc: { marginTop: nativeSpace[20] },
  rang: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
    borderTopWidth: nativeBorder.width,
  },
  corps: { flex: 1, minWidth: 0 },
  texte: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  quand: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[2] },
});

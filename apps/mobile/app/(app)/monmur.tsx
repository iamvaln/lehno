import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  receivedWishListSchema, wallSchema,
  type ReceivedWish, type Wall, type WallInterest,
} from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, Icon, LoadingState, SectionLabel, Toast, useCouleurs,
} from "@lehno/ui-native";
import { Bascule } from "../../composants/Bascule.js";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { dateCourte } from "../../lib/carnet.js";
import {
  basculeLInteret, corpsDExposition, decisionInverse, etatDuMot, motsARegarder,
  peutPartager,
} from "../../lib/mur.js";

/* Mon Mur — §3.10.
 *
 * DEUX MOITIÉS DISTINCTES : ce que la page MONTRE, et ce qu'elle a REÇU. Les
 * empiler ferait défiler tout un panneau de réglages pour lire un mot.
 *
 * L'ADRESSE SE MONTRE AVANT LA PUBLICATION — « pour qu'on sache ce qu'on
 * s'apprête à ouvrir » — et ne se PARTAGE qu'après : la faire circuler avant
 * que la page ne réponde enverrait des gens sur un refus.
 *
 * CE QUE LA MAQUETTE DEMANDE ET QUE LE CONTRAT NE PORTE PAS : un interrupteur
 * « Ma wishlist ». `updateWallSchema` accepte `isEnabled`, `showBirthdayDate`,
 * `welcomeMessage` et l'ensemble des goûts publics — rien sur la wishlist. Un
 * interrupteur sans effet apprend à ne pas croire les interrupteurs, donc il
 * n'est pas là.
 *
 * ET « MES GOÛTS » N'EST PAS UN INTERRUPTEUR mais une LISTE : chaque goût est
 * public ou non, séparément. Un seul bouton pour tous exposerait d'un coup ce
 * qu'on avait trié.
 */
export default function MonMur() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [mur, setMur] = useState<Wall | null>(null);
  const [interets, setInterets] = useState<WallInterest[]>([]);
  const [mots, setMots] = useState<ReceivedWish[]>([]);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const lu = wallSchema.parse(await appel<unknown>("/me/wall"));
      setMur(lu);
      setInterets(lu.interests);
      try {
        setMots(receivedWishListSchema.parse(await appel<unknown>("/me/received-wishes")));
      } catch { /* Les mots se taisent, la page se règle quand même. */ }
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue]);

  useEffect(() => { void charge(); }, [charge]);

  /* ON POSE L'ÉTAT AVANT LA RÉPONSE et on le remet si elle refuse : un
     interrupteur qui attend un aller-retour donne l'impression de ne pas avoir
     été touché, on rappuie, et deux demandes partent en sens contraire. */
  const regle = async (corps: Record<string, unknown>, defaire: () => void): Promise<void> => {
    setEchec(null);
    try {
      setMur(wallSchema.parse(await appel<unknown>("/me/wall", {
        method: "PATCH",
        body: JSON.stringify(corps),
      })));
    } catch (e) {
      defaire();
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  const basculeUnGout = (id: string): void => {
    const avant = interets;
    const apres = basculeLInteret(interets, id);
    setInterets(apres);
    void regle(corpsDExposition(apres), () => setInterets(avant));
  };

  const trancheUnMot = async (m: ReceivedWish): Promise<void> => {
    const avant = mots;
    const decision = decisionInverse(m);
    setMots(mots.map((x) => (x.id === m.id ? { ...x, status: decision } : x)));
    try {
      await appel<unknown>(`/me/received-wishes/${m.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
    } catch (e) {
      setMots(avant);
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  if (echec && !mur) {
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

  if (!mur) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={4} title={t.chargement} />
      </View>
    );
  }

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

        {/* L'adresse, sélectionnable — l'appui long copie, faute de
            presse-papiers embarqué. Elle se lit même hors ligne : c'est ce
            qu'on s'apprête à ouvrir. */}
        <Text selectable style={[styles.adresse, { color: couleurs.textBody }]}>
          {mur.publicUrl}
        </Text>
        <Text style={[styles.etat, { color: couleurs.textMention }]}>
          {mur.isEnabled ? t.murPrivPublie : t.murPrivPrive}
        </Text>

        <View style={styles.bloc}>
          <Bascule
            premier
            libelle={t.murPrivBascule}
            actif={mur.isEnabled}
            onBascule={(v) => void regle({ isEnabled: v }, () => undefined)}
          />
          {peutPartager(mur) ? (
            <Button
              full
              variant="outline"
              icon="send"
              onPress={() => void Share.share({ message: mur.publicUrl })}
            >
              {t.murPrivVoir}
            </Button>
          ) : null}
        </View>

        <View style={styles.bloc}>
          <SectionLabel>{t.murPrivExpose}</SectionLabel>
          <Bascule
            premier
            libelle={t.murPrivDate}
            actif={mur.showBirthdayDate}
            onBascule={(v) => void regle({ showBirthdayDate: v }, () => undefined)}
          />
          {/* CHAQUE GOÛT SÉPARÉMENT : un seul interrupteur pour tous exposerait
              d'un coup ce qu'on avait trié. */}
          {interets.length ? (
            <View style={{ marginTop: nativeSpace[12] }}>
              <SectionLabel>{t.murPrivGouts}</SectionLabel>
              {interets.map((i) => (
                <Bascule
                  key={i.id}
                  libelle={i.value}
                  actif={i.isPublic}
                  onBascule={() => basculeUnGout(i.id)}
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* LES MOTS REÇUS. « Épingler » et « détacher » sont les noms de la
            maquette pour ce que le contrat appelle approuver et refuser — et ce
            sont les siens qui parlent à qui lit l'écran. */}
        <View style={styles.bloc}>
          <SectionLabel>{t.murPrivMots}</SectionLabel>
          <Text style={[styles.aide, { color: couleurs.textMention }]}>
            {t.murPrivEpinglesAide}
          </Text>
          {mots.length ? (
            motsARegarder(mots).map((m, i) => (
              <View
                key={m.id}
                style={[styles.mot, i > 0 ? {
                  borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
                } : null]}
              >
                <View style={styles.corps}>
                  <Text style={[styles.texte, { color: couleurs.textBody }]}>{m.content}</Text>
                  {/* Nul quand la contribution était anonyme — et « Sans nom »
                      le dit plutôt que de laisser un blanc qu'on prendrait pour
                      un défaut d'affichage. */}
                  <Text style={[styles.aide, { color: couleurs.textMention }]} numberOfLines={1}>
                    {m.authorName ?? t.murPrivSansNom}
                    {" · "}
                    {dateCourte(m.createdAt.slice(0, 10), langue)}
                  </Text>
                </View>
                <Button variant="text" onPress={() => void trancheUnMot(m)}>
                  {etatDuMot(m) === "affiche" ? t.murPrivDetacher : t.murPrivEpingler}
                </Button>
              </View>
            ))
          ) : (
            <Text style={[styles.aide, { color: couleurs.textMention }]}>
              {t.murPrivMotsCompte(0)}
            </Text>
          )}
        </View>
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
  adresse: { fontFamily: nativeFont.displayMedium, fontSize: 20, marginTop: nativeSpace[8] },
  etat: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[2] },
  bloc: { marginTop: nativeSpace[24] },
  aide: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[6] },
  mot: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
  },
  corps: { flex: 1, minWidth: 0 },
  texte: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
});

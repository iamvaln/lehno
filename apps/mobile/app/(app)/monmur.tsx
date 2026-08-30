import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { wallSchema, type Wall, type WallInterest } from "@lehno/contracts";
import { nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, Icon, LoadingState, SectionLabel, Toast, useCouleurs,
} from "@lehno/ui-native";
import { Bascule } from "../../composants/Bascule.js";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { basculeLInteret, corpsDExposition, peutPartager } from "../../lib/mur.js";

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
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    try {
      const lu = wallSchema.parse(await appel<unknown>("/me/wall"));
      setMur(lu);
      setInterets(lu.interests);
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
          {/* L'APERÇU se lit toujours, même Mur éteint : c'est justement
              avant de publier qu'on veut savoir ce qu'on s'apprête à ouvrir. */}
          <Button
            full
            variant="outline"
            icon="eye"
            onPress={() => routeur.push("/(app)/apercu")}
          >
            {t.murPrivApercu}
          </Button>
          {/* LE PARTAGE, LUI, ATTEND LA PUBLICATION : `publicUrl` existe même
              éteint — c'est l'adresse qu'il AURA — et la faire circuler avant
              que la page ne réponde enverrait des gens sur un refus. */}
          {peutPartager(mur) ? (
            <Button
              full
              variant="text"
              icon="send"
              onPress={() => void Share.share({ message: mur.publicUrl })}
            >
              {t.moiPartager}
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

        {/* L'ÉPINGLAGE SE FAIT ICI — MAIS LE CONTRAT NE LE SERT PAS ENCORE.
     
            Deux corrections successives m'ont amené là, et la seconde annule à
            moitié la première.
     
            J'avais posé « Épingler » en croyant que `approved` / `rejected`
            réglait la visibilité. C'est faux : retenir veut dire qu'on
            CONSIDÈRE un cadeau pour l'achat, épingler qu'on garde un mot
            VISIBLE. Deux gestes sous des mots voisins, et le second n'a rien à
            faire dans le sas de §3.8.
     
            Mais j'en avais tiré que l'épinglage n'existait pas. Le handoff du
            30 août dit l'inverse, et tranche une contradiction de la spec —
            §3.4 « ne s'affichent jamais », §3.5 « le propriétaire décide » :
            « PRIVÉ PAR DÉFAUT, ÉPINGLABLE UN PAR UN. Rien ne paraît tout seul ;
            le propriétaire choisit, geste par geste, DEPUIS MonMurScreen. » La
            page n'est pas un livre d'or parce que l'épinglage est SÉLECTIF, pas
            parce qu'il n'existe pas.
     
            Ce qui manque est donc au CONTRAT : `receivedWishSchema` porte
            `is_public` et `show_author` « en les disant inactifs », gardés
            dehors, et aucune route ne les bascule. `publicWallSchema` n'a pas
            non plus de mots épinglés, que `WallPage` attend en `epingles`.
     
            Le geste revient ici le jour où ces trois manques sont comblés. */}
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

import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ownerWishListSchema, type OwnerWish } from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, Card, EmptyState, Icon, LoadingState, SectionLabel, Tag,
  TextField, Toast, useCouleurs,
} from "@lehno/ui-native";
import { Bascule } from "../../composants/Bascule.js";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { ecranEteint } from "../../lib/navigation.js";
import { EcranFerme } from "../../composants/EcranFerme.js";
import {
  corpsDeCreation, corpsDeMarque, corpsDeVisibilite, etatDuSouhait,
  nomDuReserveur, type SaisieDeSouhait,
} from "../../lib/souhaits.js";

/* Les souhaits d'une liste — §3.19.
 *
 * LE CHAÎNON QUI MANQUAIT. On pouvait créer une wishlist et jamais la
 * remplir — donc jamais la partager, puisque le partage exige au moins un
 * souhait. Une liste vide demanderait à un proche de choisir dans rien.
 *
 * « RÉSERVÉ » NE SE POSE PAS À LA MAIN. Le contrat l'interdit : « le laisser
 * poser permettrait de déclarer pris un cadeau que personne n'a réservé, donc
 * de le retirer de la liste partagée sans qu'aucune réservation ne
 * l'explique ». L'écran n'offre donc que « libre » et « déjà offert ».
 *
 * ET LE SILENCE N'EST PAS UNE ABSENCE : un souhait peut être réservé SANS nom.
 * « Nul ne veut pas dire *personne n'a réservé*, mais *aucun nom n'a été
 * donné* » — les confondre ferait racheter le même cadeau.
 */
export default function Souhaits() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();
  /* UNE ROUTE RESTE UNE ROUTE. La navigation ne propose plus cet écran
     quand son drapeau est éteint, mais un lien profond l'atteint encore :
     il se garde donc lui-même plutôt que de compter sur celui qui l'ouvre. */
  const eteint = ecranEteint("listes", actives);
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [souhaits, setSouhaits] = useState<OwnerWish[] | null>(null);
  const [saisie, setSaisie] = useState<SaisieDeSouhait>({
    intitule: "", lien: "", details: "", prix: "", devise: "XAF", public: true,
  });
  const [envoi, setEnvoi] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    if (!id) return;
    try {
      setSouhaits(ownerWishListSchema.parse(
        await appel<unknown>(`/me/wishlists/${id}/wishes`),
      ));
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [id, langue]);

  useFocusEffect(useCallback(() => { if (!eteint) void charge(); }, [charge, eteint]));

  const ajoute = async (): Promise<void> => {
    if (!id) return;
    setEnvoi(true);
    setEchec(null);
    try {
      await appel<unknown>(`/me/wishlists/${id}/wishes`, {
        method: "POST",
        body: JSON.stringify(corpsDeCreation(saisie)),
      });
      setSaisie({ intitule: "", lien: "", details: "", prix: "", devise: "XAF", public: true });
      setAccuse(t.souhaitModifieFait);
      await charge();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  const regle = async (s: OwnerWish, corps: unknown): Promise<void> => {
    setEchec(null);
    try {
      await appel<unknown>(`/me/owner-wishes/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify(corps),
      });
      await charge();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  const retire = async (s: OwnerWish): Promise<void> => {
    setEchec(null);
    try {
      await appel<unknown>(`/me/owner-wishes/${s.id}`, { method: "DELETE" });
      setAccuse(t.souhaitRetireFait);
      await charge();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
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

  if (echec && souhaits === null) {
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

  if (souhaits === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[8] }]}>
        {retour}
        <LoadingState variant="liste" rows={4} title={t.chargement} />
      </View>
    );
  }

  if (eteint) return <EcranFerme />;

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }}>
      <ScrollView
        contentContainerStyle={[styles.page, {
          paddingTop: insets.top + nativeSpace[8],
          paddingBottom: insets.bottom + nativeSpace[24],
        }]}
        keyboardShouldPersistTaps="handled"
      >
        {retour}

        {echec ? (
          <View style={{ marginBottom: nativeSpace[12] }}>
            <Banner intent="error">{echec}</Banner>
          </View>
        ) : null}

        {souhaits.length ? (
          souhaits.map((s) => {
            const etat = etatDuSouhait(s);
            const qui = nomDuReserveur(s);
            return (
              <Card key={s.id} surface="panel" padding={15} radius="lg" style={styles.carte}>
                <View style={styles.entete}>
                  <Text style={[styles.quoi, { color: couleurs.textBody }]} numberOfLines={2}>
                    {s.label}
                  </Text>
                  {etat === "offert" ? <Tag tone="quiet">{t.souhaitOffertEtat}</Tag> : null}
                  {etat === "reserve" ? <Tag tone="quiet">{t.souhaitReserve}</Tag> : null}
                </View>

                {s.price !== null && s.currency ? (
                  <Text style={[styles.mention, { color: couleurs.textSecondary }]}>
                    {s.price} {s.currency}
                  </Text>
                ) : null}
                {s.details ? (
                  <Text style={[styles.mention, { color: couleurs.textSecondary }]}>
                    {s.details}
                  </Text>
                ) : null}

                {/* RÉSERVÉ SANS NOM RESTE RÉSERVÉ. La phrase le dit plutôt que
                    de laisser un blanc qu'on lirait comme « personne ». */}
                {etat === "reserve" ? (
                  <Text style={[styles.mention, { color: couleurs.textMention }]}>
                    {qui ? t.souhaitReservePar(qui) : t.souhaitReserveAnonyme}
                  </Text>
                ) : null}

                <Bascule
                  premier
                  libelle={t.souhaitVisible}
                  actif={s.isPublic}
                  onBascule={() => void regle(s, corpsDeVisibilite(s))}
                />

                <View style={styles.actions}>
                  {/* Seuls « libre » et « déjà offert » s'écrivent. Sur un
                      souhait réservé, le geste mène à « offert » — quelqu'un
                      l'a pris, on le marque reçu le jour venu. */}
                  <Button full variant="outline" onPress={() => void regle(s, corpsDeMarque(s))}>
                    {etat === "offert" ? t.souhaitDisponible : t.souhaitOffert}
                  </Button>
                  <Button full variant="text" onPress={() => void retire(s)}>
                    {t.souhaitRetirer}
                  </Button>
                  {/* Retirer un souhait réservé emporte la réservation : la
                      copie le dit, et quelqu'un attend peut-être de l'offrir. */}
                  {etat === "reserve" ? (
                    <Text style={[styles.mention, { color: couleurs.textMention }]}>
                      {t.souhaitRetraitReserve}
                    </Text>
                  ) : null}
                </View>
              </Card>
            );
          })
        ) : (
          <EmptyState
            illustration="souhaits-vide"
            title={t.souhaitAjouterTitre}
            text={t.souhaitVisibleAide}
          />
        )}

        <View style={styles.bloc}>
          <SectionLabel>{t.souhaitAjouterTitre}</SectionLabel>
          <TextField
            label={t.souhaitQuoi}
            placeholder={t.souhaitQuoiExemple}
            value={saisie.intitule}
            onChangeText={(v) => setSaisie({ ...saisie, intitule: v })}
          />
          <View style={{ marginTop: nativeSpace[12] }}>
            <TextField
              label={t.souhaitCombien}
              value={saisie.prix}
              onChangeText={(v) => setSaisie({ ...saisie, prix: v })}
            />
          </View>
          <View style={{ marginTop: nativeSpace[12] }}>
            <TextField
              multiline
              label={t.souhaitPrecisions}
              placeholder={t.souhaitPrecisionsExemple}
              value={saisie.details}
              onChangeText={(v) => setSaisie({ ...saisie, details: v })}
            />
          </View>
          <View style={{ marginTop: nativeSpace[12] }}>
            {/* Un intitulé vide n'est pas un souhait : le bouton le dit avant
                l'aller-retour, plutôt que d'aller chercher un refus. */}
            <Button
              full
              icon="plus"
              disabled={envoi || saisie.intitule.trim().length === 0}
              onPress={() => void ajoute()}
            >
              {t.souhaitAjouter}
            </Button>
          </View>
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
  carte: { marginTop: nativeSpace[12] },
  entete: { flexDirection: "row", alignItems: "center", gap: nativeSpace[10] },
  quoi: { flex: 1, fontFamily: nativeFont.bodySemibold, fontSize: 15 },
  mention: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[6] },
  actions: { marginTop: nativeSpace[8] },
  bloc: {
    marginTop: nativeSpace[24], borderTopWidth: nativeBorder.width,
    paddingTop: nativeSpace[16],
  },
});

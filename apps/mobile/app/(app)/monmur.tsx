import { useCallback, useEffect, useState } from "react";
import {
  Linking, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  estActive, receivedWishListSchema, wallSchema,
  type ReceivedWish, type Wall, type WallInterest,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeRadius, nativeSpace, nativeTouchMin,
} from "@lehno/tokens";
import {
  Banner, Button, Card, EmptyState, Icon, LoadingState, Quote, ScreenHeader, SectionLabel,
  Toast, useCouleurs
} from "@lehno/ui-native";
import { Bascule } from "../../composants/Bascule.js";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { dateCourte } from "../../lib/carnet.js";
import {
  basculeLInteret, corpsDExposition, motsRecus, ongletDemande, ongletsDuMur,
  peutPartager, rienDExpose, signatureDuMot, type OngletDuMur,
} from "../../lib/mur.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { ecranEteint } from "../../lib/navigation.js";
import { EcranFerme } from "../../composants/EcranFerme.js";

/* Mon Mur — §3.10.
 *
 * DEUX MOITIÉS DISTINCTES, ET DEUX ONGLETS : ce que la page MONTRE, et ce
 * qu'elle a REÇU. Les empiler faisait défiler tout un panneau de réglages pour
 * lire un mot — le kit a tranché en séparant les vues.
 *
 * L'ADRESSE SE MONTRE AVANT LA PUBLICATION — « pour qu'on sache ce qu'on
 * s'apprête à ouvrir » — et ne SORT D'ICI qu'après : la faire circuler, ou
 * l'ouvrir dans le navigateur, avant que la page ne réponde enverrait des gens
 * sur un refus. C'est la même règle pour « Partager » et pour « Voir ma page ».
 *
 * PAS DE BOUTON « COPIER LE LIEN », ET C'EST UN MANQUE DE LA PILE, pas un
 * oubli. Aucun presse-papiers n'est embarqué — `expo-clipboard` est un module
 * natif de plus, et le parc porte un client de développement qui ne l'a pas.
 * L'adresse est donc SÉLECTIONNABLE : l'appui long copie, et un bouton
 * « Copier » qui ne copierait rien serait pire que son absence. Même choix
 * qu'en §3.9 et sur le parrainage. Le partage, lui, marche.
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
  const { actives } = useDrapeaux();
  /* UNE ROUTE RESTE UNE ROUTE. La navigation ne propose plus cet écran
     quand son drapeau est éteint, mais un lien profond l'atteint encore :
     il se garde donc lui-même plutôt que de compter sur celui qui l'ouvre. */
  const eteint = ecranEteint("monmur", actives);
  const { onglet } = useLocalSearchParams<{ onglet?: string }>();

  const [mur, setMur] = useState<Wall | null>(null);
  const [interets, setInterets] = useState<WallInterest[]>([]);
  const [mots, setMots] = useState<ReceivedWish[] | null>(null);
  /* SÉPARÉ DE `echec` : une lecture des mots qui échoue ne doit pas couvrir le
     réglage de la page d'un bandeau rouge, ni le faire disparaître. La panne se
     dit dans l'onglet qui la subit, et nulle part ailleurs. */
  const [echecDesMots, setEchecDesMots] = useState<string | null>(null);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  /* NUL TANT QUE PERSONNE N'A CHOISI, et c'est ce qui rend le lien profond
     fiable : les drapeaux arrivent après le premier rendu, et un onglet figé à
     l'initialisation ouvrirait « page » à qui a demandé « mots ». Un appui,
     lui, fige la vue — sans quoi elle reviendrait à celle du lien. */
  const [choix, setChoix] = useState<OngletDuMur | null>(null);
  const ouverts = ongletsDuMur(actives);
  const demande = ongletDemande(onglet, actives);
  const vue = choix !== null && ouverts.includes(choix) ? choix : demande;

  const charge = useCallback(async () => {
    try {
      const lu = wallSchema.parse(await appel<unknown>("/me/wall"));
      setMur(lu);
      setInterets(lu.interests);
      /* LES MOTS SUIVENT LEUR PROPRE DRAPEAU, et leur échec ne renverse rien :
         `/me/received-wishes` est gardé par `wishes`. L'appeler éteint rendrait
         un refus qu'on afficherait en rouge sur un compte sain, et une lecture
         manquée ne doit pas emporter le réglage de la page. */
      if (estActive(actives, "wishes")) {
        try {
          setMots(receivedWishListSchema.parse(await appel<unknown>("/me/received-wishes")));
          setEchecDesMots(null);
        } catch (e) {
          /* On ne pose PAS une liste vide en repli : « personne n'a encore
             écrit » est une phrase qu'on ne dit qu'en le sachant. */
          setEchecDesMots(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
        }
      }
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [actives, langue]);

  useEffect(() => { if (!eteint) void charge(); }, [charge, eteint]);

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

  /* LA FLÈCHE VIT DANS TOUS LES ÉTATS, pas seulement dans le nominal :
     l'écran de panne et celui de chargement la perdaient, et avec elle le
     seul moyen visible de revenir. `retours.test.ts` le vérifie. */
  const retour = (
    <ScreenHeader titre={t.enteteMonMur} retour={t.retour} onRetour={() => routeur.back()} />
  );

  if (echec && !mur) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
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
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        {retour}
        <LoadingState variant="liste" rows={4} title={t.chargement} />
      </View>
    );
  }

  if (eteint) return <EcranFerme />;

  const listeDesMots = mots === null ? null : motsRecus(mots);

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }}>
      <ScrollView
        contentContainerStyle={[styles.page, {
          paddingTop: insets.top + nativeSpace[8],
          paddingBottom: insets.bottom + nativeSpace[24],
        }]}
      >
        {retour}

        {echec ? (
          <View style={{ marginBottom: nativeSpace[12] }}>
            <Banner intent="error">{echec}</Banner>
          </View>
        ) : null}

        {/* UN SEUL ONGLET NE SE DESSINE PAS : quand `wishes` est éteint, la
            barre annoncerait un choix qui n'en est pas un. */}
        {ouverts.length > 1 ? (
          <View style={[styles.onglets, { backgroundColor: couleurs.surfacePanel }]}>
            {ouverts.map((cle) => {
              const actif = vue === cle;
              return (
                <Pressable
                  key={cle}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actif }}
                  onPress={() => setChoix(cle)}
                  style={[styles.onglet, {
                    backgroundColor: actif ? couleurs.surfaceCard : "transparent",
                    borderColor: actif ? couleurs.action : "transparent",
                  }]}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.ongletTexte, {
                      color: actif ? couleurs.textAccent : couleurs.textSecondary,
                      fontFamily: actif ? nativeFont.bodyMedium : nativeFont.bodyRegular,
                    }]}
                  >
                    {cle === "page"
                      ? t.murPrivOngletPage
                      /* LE DÉCOMPTE SE TAIT TANT QU'ON N'A PAS LU : la copie ne
                         suffixe rien à zéro, et c'est exactement ce qu'il faut
                         avant la réponse — un « · 0 » affirmerait que personne
                         n'a écrit à quelqu'un qui a peut-être dix mots. */
                      : t.murPrivOngletMots(listeDesMots?.length ?? 0)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {vue === "page" ? (
          <>
            <Card padding={15} radius="lg">
              <View style={styles.entete}>
                <View style={styles.corps}>
                  {/* L'adresse, SÉLECTIONNABLE — l'appui long copie, faute de
                      presse-papiers embarqué. Elle se lit même hors ligne :
                      c'est ce qu'on s'apprête à ouvrir. */}
                  <Text selectable style={[styles.adresse, { color: couleurs.textBody }]}>
                    {mur.publicUrl}
                  </Text>
                  <Text style={[styles.etat, {
                    color: mur.isEnabled ? couleurs.feedbackSuccess : couleurs.textMention,
                  }]}>
                    {mur.isEnabled ? t.murPrivPublie : t.murPrivPrive}
                  </Text>
                </View>
                {/* LA BASCULE VIT EN HAUT, pas enfouie dans des réglages : « on
                    doit pouvoir préparer sa page avant de l'ouvrir ». Un
                    `Switch` nu et non une ligne à interrupteur : son libellé
                    est déjà à côté — l'adresse et son état — et `Bascule` en
                    poserait un second, redondant à l'œil et lu deux fois par
                    un lecteur d'écran. D'où l'étiquette portée à la main. */}
                <Switch
                  value={mur.isEnabled}
                  onValueChange={(v) => void regle({ isEnabled: v }, () => undefined)}
                  accessibilityLabel={t.murPrivBascule}
                  trackColor={{ false: couleurs.borderObject, true: couleurs.action }}
                />
              </View>
              {peutPartager(mur) ? (
                <>
                  <Text style={[styles.aide, { color: couleurs.textMention }]}>
                    {t.moiMurVisible}
                  </Text>
                  {/* LE PARTAGE ATTEND LA PUBLICATION : `publicUrl` existe même
                      éteint — c'est l'adresse qu'il AURA — et la faire circuler
                      avant que la page ne réponde enverrait des gens sur un
                      refus. Le geste vit avec l'adresse, pas dans un menu. */}
                  <Button
                    variant="text"
                    icon="send"
                    onPress={() => void Share.share({ message: mur.publicUrl })}
                  >
                    {t.moiPartager}
                  </Button>
                </>
              ) : null}
            </Card>

            <View style={styles.bloc}>
              <SectionLabel>{t.murPrivExpose}</SectionLabel>
              <Bascule
                premier
                libelle={t.murPrivDate}
                actif={mur.showBirthdayDate}
                onBascule={(v) => void regle({ showBirthdayDate: v }, () => undefined)}
              />
              {/* CHAQUE GOÛT SÉPARÉMENT : un seul interrupteur pour tous
                  exposerait d'un coup ce qu'on avait trié. */}
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
              {/* RIEN D'EXPOSÉ EST UN ÉTAT : l'adresse s'ouvre et ne dit rien
                  de soi. Le dire vaut mieux qu'un alignement d'interrupteurs
                  éteints. */}
              {rienDExpose(mur, interets) ? (
                <Text style={[styles.aide, { color: couleurs.textMention }]}>
                  {t.murPrivRienExpose}
                </Text>
              ) : null}
            </View>
          </>
        ) : echecDesMots ? (
          <View style={{ gap: nativeSpace[12] }}>
            <Banner intent="error">{echecDesMots}</Banner>
            <Button variant="outline" full icon="refresh-cw" onPress={() => void charge()}>
              {t.maintReessayer}
            </Button>
          </View>
        ) : listeDesMots === null ? (
          <LoadingState variant="liste" rows={3} title={t.chargement} />
        ) : listeDesMots.length === 0 ? (
          <EmptyState
            illustration="mur-aucun-mot"
            title={t.murPrivAucunMotTitre}
            text={t.murPrivAucunMotTexte}
          />
        ) : (
          <View>
            <Text style={[styles.compte, { color: couleurs.textMention }]}>
              {t.murPrivMotsCompte(listeDesMots.length)}
            </Text>
            {/* PAS D'ÉPINGLAGE ICI, ET LE MANQUE EST AU CONTRAT.

                Le handoff du 30 août tranche une contradiction de la spec —
                §3.4 « ne s'affichent jamais », §3.5 « le propriétaire décide » :
                « privé par défaut, ÉPINGLABLE UN PAR UN, depuis MonMurScreen ».
                Le geste appartient donc bien à cet écran, et le kit le dessine.

                Mais `receivedWishSchema` ne rend ni `isPublic` ni `showAuthor`
                — il les refuse, `.strict()` à l'appui — aucune route ne les
                bascule, et `publicWallSchema` ne porte aucun mot épinglé. Un
                bouton « Épingler » qui n'épingle rien apprendrait à ne pas
                croire les boutons ; l'aide qui l'accompagne — « un mot épinglé
                s'affiche sur votre Mur » — serait une promesse fausse.

                Les mots se LISENT donc, et c'est déjà ce que le kit promet en
                premier : ils sont privés. Le geste revient le jour où le
                contrat le sert. */}
            <View style={{ gap: nativeSpace[10] }}>
              {listeDesMots.map((m) => (
                <Card key={m.id} padding={15} radius="lg">
                  <Quote size={15}>{m.content}</Quote>
                  <View style={styles.signature}>
                    <Icon name="user" size={13} color={couleurs.textMention} />
                    <Text
                      style={[styles.signatureTexte, { color: couleurs.textMention }]}
                      numberOfLines={1}
                    >
                      {/* La date vient de `createdAt`, jamais d'une durée
                          composée ici : « il y a deux jours » du kit est une
                          valeur de planche, et la recalculer demanderait une
                          horloge que rien ne rafraîchit. */}
                      {signatureDuMot(m, t.murPrivSansNom,
                        dateCourte(m.createdAt.slice(0, 10), langue))}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )}

        <View style={styles.pied}>
          {/* L'APERÇU se lit toujours, même Mur éteint : c'est justement avant
              de publier qu'on veut savoir ce qu'on s'apprête à ouvrir. */}
          <Button
            full
            variant="outline"
            icon="eye"
            onPress={() => routeur.push("/(app)/apercu")}
          >
            {t.murPrivApercu}
          </Button>
          {/* DEHORS, et seulement une fois publié. L'adresse vient du SERVEUR —
              `mur.publicUrl` — jamais d'un paramètre de route : `…?url=` ferait
              ouvrir n'importe quelle adresse par l'application. */}
          {peutPartager(mur) ? (
            <Button
              full
              variant="text"
              icon="external-link"
              onPress={() => {
                setAccuse(t.murVoirDehors);
                void Linking.openURL(mur.publicUrl);
              }}
            >
              {t.murPrivVoir}
            </Button>
          ) : null}
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
  onglets: {
    flexDirection: "row", gap: nativeSpace[4], padding: nativeSpace[4],
    borderRadius: nativeRadius.lg, marginBottom: nativeSpace[16],
  },
  onglet: {
    flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center",
    borderRadius: nativeRadius.md, borderWidth: nativeBorder.width,
    paddingHorizontal: nativeSpace[8],
  },
  ongletTexte: { fontSize: 14 },
  entete: { flexDirection: "row", alignItems: "center", gap: nativeSpace[12] },
  corps: { flex: 1, minWidth: 0 },
  adresse: { fontFamily: nativeFont.displayMedium, fontSize: 19 },
  etat: { fontFamily: nativeFont.bodyMedium, fontSize: 11.5, marginTop: nativeSpace[2] },
  bloc: { marginTop: nativeSpace[24] },
  aide: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[8] },
  compte: {
    fontFamily: nativeFont.bodyRegular, fontSize: 12.5,
    marginTop: nativeSpace[2], marginBottom: nativeSpace[10],
  },
  signature: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[8],
    marginTop: nativeSpace[10],
  },
  signatureTexte: { flex: 1, fontFamily: nativeFont.bodyRegular, fontSize: 12 },
  pied: { marginTop: nativeSpace[20], gap: nativeSpace[8] },
});

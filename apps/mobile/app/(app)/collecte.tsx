import { useCallback, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  collectionLinkSchema, personSchema, publicCollectFormSchema, submissionSchema,
  type CollectionLink, type Person, type PublicCollectForm, type Submission,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin,
  nativeTracking,
} from "@lehno/tokens";
import {
  Banner, Button, Card, EmptyState, Icon, Illustration, LoadingState, ScreenHeader,
  SectionLabel, Tag, TextField, Toast, useCouleurs
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, appelPublic, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import {
  aTrancherPour, corpsDeCreation, dateDejaProposee, designeUneFiche,
  deTropDansLeMot, etatDeLaCollecte, lienVivantPour, motDeCollecte, motTient, proposeLeMur, recuesPour,
} from "../../lib/collecte.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { ecranEteint } from "../../lib/navigation.js";
import { EcranFerme } from "../../composants/EcranFerme.js";

/* Le lien de collecte — §3.20.
 *
 * « Envoyez ce lien : ce qui en revient passe par votre validation avant
 * d'entrer dans la fiche. » C'est ce qui rend le sas de §3.8 utile : sans lien,
 * rien n'arrive.
 *
 * ─── PARTAGER TIENT ; COPIER, NON
 *
 * `collectionLinkSchema` sert désormais `url`, composé par le SERVEUR — comme
 * le Mur et la liste de souhaits. Le client ne la reconstitue pas : le domaine
 * public change (préproduction, essai), et deux versions du parc en
 * fabriqueraient deux différentes.
 *
 * COPIER reste absent, faute de presse-papiers embarqué : `expo-clipboard` est
 * un module natif, et l'ajouter demande une reconstruction. `Share` couvre le
 * besoin — la feuille du système propose « Copier » elle-même.
 *
 * LE MOT D'ACCOMPAGNEMENT tient sa promesse. Le contrat le porte à la création
 * et la page publique le sert : « il s'affiche en haut de la page qu'on
 * ouvrira » n'est plus une phrase en l'air.
 *
 * IL S'ENREGISTRE PAR UN GESTE, jamais en sortant du champ. Une écriture
 * silencieuse sur un champ qu'on relit sans le vouloir modifierait ce que le
 * proche verra sans que personne l'ait demandé. Le bouton n'apparaît donc que
 * lorsque le texte a bougé, et disparaît une fois écrit.
 *
 * RÉACTIVER, EN REVANCHE, EXISTE : le contrat n'offre que créer et révoquer, et
 * la copie anglaise le dit elle-même — « Create a new link ». Le bouton porte
 * donc le libellé de la maquette et crée un lien neuf. Un lien révoqué « ne
 * mène plus à rien » et ne se rallume pas ; celui qui l'avait reçu devra
 * recevoir le nouveau, et c'est précisément le sens d'une révocation.
 */
const listeDeLiens = collectionLinkSchema.array();
const listeDeContributions = submissionSchema.array();

export default function Collecte() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();
  /* UNE ROUTE RESTE UNE ROUTE. La navigation ne propose plus cet écran
     quand son drapeau est éteint, mais un lien profond l'atteint encore :
     il se garde donc lui-même plutôt que de compter sur celui qui l'ouvre. */
  const eteint = ecranEteint("collecte", actives);
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [proche, setProche] = useState<Person | null>(null);
  const [liens, setLiens] = useState<CollectionLink[] | null>(null);
  const [contributions, setContributions] = useState<Submission[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  /* Le mot en cours de saisie, et celui qui est ENREGISTRÉ. Deux états, parce
     que c'est leur écart qui décide d'afficher le bouton — un seul état ne
     saurait pas dire si ce qu'on lit vient du serveur ou du clavier. */
  const [mot, setMot] = useState("");
  const [motEnregistre, setMotEnregistre] = useState<string | null>(null);
  const [apercu, setApercu] = useState<PublicCollectForm | null>(null);
  const [apercuEchec, setApercuEchec] = useState<string | null>(null);

  const charge = useCallback(async () => {
    if (!id) return;
    try {
      const [brutProche, brutLiens, brutContributions] = await Promise.all([
        appel<unknown>(`/me/persons/${id}`),
        appel<unknown>("/me/collection-links"),
        appel<unknown>("/me/submissions"),
      ]);
      setProche(personSchema.parse(brutProche));
      const lus = listeDeLiens.parse(brutLiens);
      setLiens(lus);
      /* Le mot du lien VIVANT de cette fiche. On le repose à chaque chargement :
         l'écran se rouvre après un aller-retour, et un champ resté sur une
         saisie abandonnée ferait croire qu'elle a été enregistrée. */
      const sien = lienVivantPour(lus, id)?.message ?? null;
      setMotEnregistre(sien);
      setMot(sien ?? "");
      setContributions(listeDeContributions.parse(brutContributions));
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [id, langue]);

  useFocusEffect(useCallback(() => { if (!eteint) void charge(); }, [charge, eteint]));

  const cree = async (reactivation: boolean): Promise<void> => {
    if (!id) return;
    setEnvoi(true);
    setEchec(null);
    try {
      await appel<unknown>("/me/collection-links", {
        method: "POST",
        body: JSON.stringify(corpsDeCreation("nominatif", id, motDeCollecte(mot))),
      });
      if (reactivation) setAccuse(t.collecteReactiveFait);
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
      /* L'APERÇU TOMBE AVEC LE LIEN. Le garder à l'écran montrerait une page
         qui répond déjà 410 — on relirait tranquillement ce qu'on vient de
         reprendre au monde. */
      setApercu(null);
      setApercuEchec(null);
      setAccuse(t.collecteRevoqueFait);
      await charge();
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  /* L'APERÇU SE LIT SUR LA SURFACE PUBLIQUE ELLE-MÊME, sans session — c'est
     exactement ce que reçoit celui à qui on envoie le lien. Recomposer la page
     depuis la fiche donnerait deux vérités, et celle de l'écran finirait par
     flatter : elle montrerait ce que je crois avoir mis dans le lien.

     LE JETON VIENT DE `/me/collection-links`, JAMAIS DE LA NAVIGATION. Un
     paramètre de route se pose par lien profond : `…/collecte?jeton=<au
     choix>` ferait ouvrir la page d'un inconnu sous le titre « la page qui
     s'ouvrira », et on la lirait comme la sienne. C'est la raison pour
     laquelle l'aperçu se déplie ICI au lieu d'être un écran à part — un écran
     à part demanderait un paramètre, donc rouvrirait cette porte. */
  const ouvreLApercu = async (lien: CollectionLink): Promise<void> => {
    setApercuEchec(null);
    try {
      const brut = await appelPublic<unknown>(
        `/public/collect/${encodeURIComponent(lien.token)}`,
        { gouvernee: true },
      );
      setApercu(publicCollectFormSchema.parse(brut));
    } catch (e) {
      setApercuEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  const retour = (
    <ScreenHeader titre={t.enteteCollecte} retour={t.retour} onRetour={() => routeur.back()} />
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

  /* ENREGISTRER LE MOT emprunte la route de création, qui ROUVRE le lien
     existant plutôt que d'en frapper un second — c'est déjà sa règle, et le
     jeton en circulation ne bouge donc pas. Une route de modification à part
     n'apporterait qu'un second chemin vers la même écriture. */
  const enregistreLeMot = async (): Promise<void> => {
    await cree(false);
    setMotEnregistre(motDeCollecte(mot));
  };

  if (eteint) return <EcranFerme />;

  const etat = etatDeLaCollecte(liens, proche.id);
  const vivant = lienVivantPour(liens, proche.id);
  const recues = recuesPour(contributions, proche.id).length;
  const attendent = aTrancherPour(contributions, proche.id).length;

  const entete = (
    <>
      {retour}
      {echec ? (
        <View style={{ marginTop: nativeSpace[12] }}>
          <Banner intent="error">{echec}</Banner>
        </View>
      ) : null}
    </>
  );

  const pied = accuse ? (
    <Toast intent="success" insetBas={insets.bottom} onDismiss={() => setAccuse(null)}>
      {accuse}
    </Toast>
  ) : null;

  /* AUCUN LIEN N'A JAMAIS EXISTÉ : la maquette ne dessine pas ce cas — un banc
     d'essai part toujours d'un lien créé — et c'est pourtant celui qu'on ouvre
     le plus souvent. Il n'y a alors rien à révoquer, rien à apercevoir et rien
     qui soit revenu : un état vide, et le seul geste qui vaille. */
  if (etat === "aucun") {
    return (
      <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }}>
        <ScrollView
          contentContainerStyle={[styles.page, {
            paddingTop: insets.top + nativeSpace[8],
            paddingBottom: insets.bottom + nativeSpace[24],
          }]}
        >
          {entete}
          <EmptyState
            illustration="contribution-envoyee"
            title={t.collecteTitre(proche.displayName)}
            text={t.collecteIntro}
            actionLabel={t.ficheCollecte}
            {...(envoi ? {} : { onAction: () => void cree(false) })}
          />
        </ScrollView>
        {pied}
      </View>
    );
  }

  const revoquee = etat === "revoque";

  return (
    <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }}>
      <ScrollView
        contentContainerStyle={[styles.page, {
          paddingTop: insets.top + nativeSpace[8],
          paddingBottom: insets.bottom + nativeSpace[24],
        }]}
      >
        {entete}

        <View style={styles.vignette}>
          <Illustration name="contribution-envoyee" width={132} />
        </View>

        <Text style={[styles.titre, { color: couleurs.textBody }]} accessibilityRole="header">
          {t.collecteTitre(proche.displayName)}
        </Text>
        <Text style={[styles.intro, { color: couleurs.textSecondary }]}>{t.collecteIntro}</Text>

        {revoquee ? (
          <View style={{ marginTop: nativeSpace[16] }}>
            <Banner intent="info">{t.collecteRevoqueTexte}</Banner>
          </View>
        ) : null}

        <Card surface="panel" padding={15} radius="lg" style={styles.carte}>
          <View style={styles.ligne}>
            <Icon name="link" size={17} color={couleurs.textMention} />
            {/* L'ADRESSE, telle que le serveur la sert. C'est elle qu'on
                envoie, donc c'est elle qu'on doit lire avant d'envoyer : le
                jeton seul ne se vérifie pas d'un coup d'œil. Elle n'est PAS
                composée ici — le domaine changerait sans que le parc installé
                le sache. */}
            <Text
              selectable={!revoquee}
              numberOfLines={1}
              style={[styles.jeton, {
                color: revoquee ? couleurs.textMention : couleurs.textBody,
                ...(revoquee ? { textDecorationLine: "line-through" as const } : {}),
              }]}
            >
              {vivant ? vivant.url : t.collecteEtatRevoque}
            </Text>
            <Tag tone={revoquee ? "outline" : "quiet"}>
              {revoquee ? t.collecteEtatRevoque : t.collecteEtatActif}
            </Tag>
          </View>
        </Card>

        {/* LE MOT, seulement sur un lien vivant : l'écrire pour une adresse
            qui ne mène plus n'aurait pas de destinataire. La maquette le pose
            au même endroit, entre le lien et les gestes — on relit ce qu'on
            envoie juste avant de l'envoyer. */}
        {vivant ? (
          <View style={styles.mot}>
            <TextField
              multiline
              label={t.collecteMot(proche.callingName ?? proche.displayName)}
              placeholder={t.collecteMotExemple}
              value={mot}
              onChangeText={setMot}
              invalid={!motTient(mot)}
              /* React Native n'a pas d'état « invalide » : la faute doit vivre
                 dans le texte d'aide, sans quoi elle ne se voit que pour qui
                 voit le contour. Le compteur n'apparaît qu'une fois la borne
                 dépassée — permanent sur un champ facultatif, il presserait
                 pour rien. */
              hint={motTient(mot) ? t.collecteMotAide : t.collecteMotLimite(deTropDansLeMot(mot))}
            />
            {/* Il n'apparaît que si le texte a bougé — et disparaît une fois
                écrit. Un bouton toujours là inviterait à enregistrer ce qui
                l'est déjà, et laisserait douter de ce qui a été retenu. */}
            {motDeCollecte(mot) !== motEnregistre ? (
              <Button
                full
                variant="outline"
                icon="check"
                disabled={envoi || !motTient(mot)}
                onPress={() => void enregistreLeMot()}
              >
                {t.collecteMotEnregistrer}
              </Button>
            ) : null}
          </View>
        ) : null}

        <View style={styles.gestes}>
          {vivant ? (
            <>
              <Button
                full
                icon="send"
                disabled={envoi}
                onPress={() => void Share.share({ message: vivant.url })}
              >
                {t.collectePartager}
              </Button>
              <Button
                full
                variant="outline"
                icon="eye"
                disabled={envoi}
                onPress={() => void ouvreLApercu(vivant)}
              >
                {t.collecteApercu}
              </Button>
            </>
          ) : (
            <Button full icon="link" disabled={envoi} onPress={() => void cree(true)}>
              {t.collecteReactiver}
            </Button>
          )}
        </View>

        {apercuEchec ? (
          <View style={{ marginTop: nativeSpace[12] }}>
            <Banner intent="error">{apercuEchec}</Banner>
          </View>
        ) : null}

        {apercu ? (
          <View style={styles.bloc}>
            <SectionLabel>{t.collecteApercuTitre}</SectionLabel>
            <Card surface="panel" padding={15} radius="lg" style={{ marginTop: nativeSpace[8] }}>
              {/* Sur un lien PUBLIC le serveur tait la fiche à dessein — « y
                  servir une fiche l'exposerait à quiconque relaie l'adresse ».
                  On ne rétablit pas ce qu'il a choisi de taire. */}
              {designeUneFiche(apercu) ? (
                <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>
                  {apercu.personDisplayName}
                </Text>
              ) : null}
              <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
                {t.collecteApercuInvite(apercu.ownerDisplayName)}
              </Text>
              <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
                {dateDejaProposee(apercu) ? t.collecteApercuDate : t.collecteApercuDateAbsente}
              </Text>
              {proposeLeMur(apercu) ? (
                <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
                  {t.collecteApercuMur}
                </Text>
              ) : null}
            </Card>
          </View>
        ) : null}

        <View style={styles.bloc}>
          <SectionLabel>{t.collecteRevenu}</SectionLabel>
          {/* LE DÉCOMPTE NE S'ÉTEINT PAS AVEC LE LIEN, à l'inverse de la
              maquette qui affiche « aucune réponse » dès l'état révoqué. Ce qui
              est arrivé est arrivé : le taire ferait chercher dans le sas des
              contributions dont l'écran vient de jurer qu'elles n'existent pas.

              DEUX NOMBRES, ET LA LIGNE NE MÈNE AU SAS QUE SI L'UN D'EUX TIENT :
              le sas ne montre que ce qui attend une décision, et y envoyer sur
              un décompte déjà tranché ouvrirait un écran vide. */}
          {recues === 0 ? (
            <Text style={[styles.rien, { color: couleurs.textMention }]}>{t.collecteAucune}</Text>
          ) : attendent > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => routeur.push("/(app)/valider")}
              style={[styles.revenu, { borderTopColor: couleurs.borderHairline }]}
            >
              <Text style={[styles.revenuTexte, { color: couleurs.textBody }]}>
                {t.collecteRecu(recues)}
              </Text>
              <Icon name="chevron-right" size={15} color={couleurs.textMention} />
            </Pressable>
          ) : (
            <Text style={[styles.rien, { color: couleurs.textMention }]}>
              {t.collecteRecu(recues)}
            </Text>
          )}
        </View>

        {vivant ? (
          <View style={styles.reprise}>
            <Button
              full
              variant="text"
              disabled={envoi}
              onPress={() => void revoque(vivant)}
            >
              {t.collecteRevoquer}
            </Button>
          </View>
        ) : null}
      </ScrollView>

      {pied}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: nativeSpace[16] },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  vignette: { alignItems: "center", marginTop: nativeSpace[6] },
  titre: {
    fontFamily: nativeFont.displayMedium, fontSize: 22, marginTop: nativeSpace[16],
    letterSpacing: nativeLetterSpacing(22, nativeTracking.display),
  },
  intro: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5, marginTop: nativeSpace[8] },
  carte: { marginTop: nativeSpace[20] },
  ligne: { flexDirection: "row", alignItems: "center", gap: nativeSpace[10] },
  jeton: { flex: 1, fontFamily: nativeFont.displayMedium, fontSize: 17 },
  mot: { marginTop: nativeSpace[16], gap: nativeSpace[8] },
  gestes: { marginTop: nativeSpace[14], gap: nativeSpace[8] },
  bloc: { marginTop: nativeSpace[24] },
  nom: { fontFamily: nativeFont.displayMedium, fontSize: 19 },
  texte: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5, marginTop: nativeSpace[6] },
  rien: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginTop: nativeSpace[8] },
  revenu: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[10],
    marginTop: nativeSpace[8], paddingVertical: nativeSpace[12],
    minHeight: nativeTouchMin, borderTopWidth: nativeBorder.width,
  },
  revenuTexte: { flex: 1, fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  reprise: { marginTop: nativeSpace[20] },
});

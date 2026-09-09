import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  creditBalanceSchema, generationResultSchema, portraitSchema, profileSchema,
  studioOptionsSchema, groupesAtteignables,
  type Portrait, type StudioOptions, type StudioSelection,
} from "@lehno/contracts";
import {
  nativeFont, nativeLetterSpacing, nativeRadius, nativeSpace, nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Banner, Button, Card, CreditIndicator, EmptyState, Icon, LoadingState,
  PaidActionSheet, Provenance, SectionLabel, Toast, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../lib/langue.js";
import { appel, ErreurDApi } from "../lib/api.js";
import { messageDErreur } from "../lib/session.js";
import { useDrapeaux } from "../lib/DrapeauxProvider.js";
import { useActionsPayantes } from "../lib/MetadonneesProvider.js";
import { dateCourte } from "../lib/carnet.js";
import { coutDe } from "../lib/preparation.js";
import { delaiAvantLaProchaine, doitInterroger } from "../lib/generation.js";
import {
  apresLeChoix, approbation, changementDeSignature, etatDuPortrait, feuilleDePartage,
  laFeuilleDeposeUnFichier, laProductionEstRefusee, motDAccompagnement, offreDeRefaire,
  ouverture, relanceDuPortrait, selectionParDefaut, signatureARemettre, type Plateforme,
} from "../lib/portrait.js";
import { Bascule } from "../composants/Bascule.js";
import { Choix } from "../composants/Choix.js";

/* « Aperçu et partage d'un portrait » — §3.22.
 *
 * ON PARTAGE UN FICHIER, PAS UNE ADRESSE, et c'est ce qui change tout le bas de
 * l'écran. Le portrait est une IMAGE : elle s'enregistre et s'envoie comme
 * telle, par la feuille du téléphone, en portant son pied de marque. Il n'y a
 * donc ni lien à copier, ni « retirer du web » — et pas davantage de mise au
 * Mur : le contrat écrit que « le portrait ne s'expose à aucune adresse
 * publique ». La maquette dessine les deux boutons ; ils sont absents ici, et
 * la raison est portée par `lib/portrait.ts`, là où quelqu'un la cherchera.
 *
 * L'APPLICATION NE COMPOSE RIEN. « Le portrait est une image, son assemblage
 * appartient au serveur, et l'écran affiche ce que l'API rend. » On montre donc
 * `imageUrl`, jamais une composition refaite en React Native — deux gabarits
 * divergeraient au premier ajustement de la bande, et c'est celui du serveur
 * qui part dans les conversations.
 *
 * D'OÙ LE MOMENT « À VALIDER ». L'image se compose À L'APPROBATION : avant
 * elle, `imageUrl` est nulle et il n'y a rien à montrer. L'écran affiche alors
 * le TEXTE qui entrera dans la bande — le nom, le message, la signature —, met
 * l'approbation en avant, et n'offre ni enregistrement ni partage : ils
 * ouvriraient une feuille sur rien.
 *
 * LA VOIE ET L'AMBIANCE VIENNENT DU CATALOGUE. La maquette les pose en
 * pastilles, et le dictionnaire porte leurs libellés ; les employer serait
 * pourtant une faute — le contrat veut qu'une ambiance ajoutée en
 * administration paraisse « sans livraison », donc que les libellés arrivent
 * résolus du serveur. On lit `/me/studio/options` et on affiche ce que
 * `groupesAtteignables` rend, sans savoir ce qu'est une voie d'image.
 *
 * ET CE QU'ELLES FONT N'EST PAS CE QUE LA MAQUETTE LAISSE CROIRE. Changer une
 * pastille ne recompose pas l'image sous les yeux : rien, côté contrat, ne
 * permet de rehabiller un portrait produit. Elles règlent la PROCHAINE
 * production — d'où « Refaire », qui coûte un crédit et l'annonce.
 *
 * LA RELECTURE N'EST PAS SOUS LE DRAPEAU, et cet écran n'est donc pas fermé par
 * `generation.portrait`. Le serveur applique la même règle sur les mêmes
 * chemins : « éteindre une nature doit empêcher d'en produire de nouvelles,
 * jamais de relire ce qu'on a déjà payé ». Seuls le catalogue et « Refaire »
 * disparaissent.
 */

/* Lue une seule fois, hors du composant : `Platform.OS` ne change pas d'un
   rendu à l'autre, et la relire à chaque fois ferait croire le contraire. */
const PLATEFORME: Plateforme =
  Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "autre";

export default function PortraitEcran() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();
  const prix = useActionsPayantes();
  /* `id` : le portrait à lire. `qui` : le nom d'usage du proche, que l'appelant
     connaît — la feuille payante le nomme, et aller le rechercher ferait un
     appel pour une phrase. Ni l'un ni l'autre n'est de confiance : `ouverture`
     éprouve la forme du premier, et le second ne sert qu'à écrire. */
  const { id, qui } = useLocalSearchParams<{ id?: string; qui?: string }>();

  const ouvre = useMemo(() => ouverture(id), [id]);
  const chemin = ouvre.sorte === "lire" ? ouvre.chemin : null;

  const [portrait, setPortrait] = useState<Portrait | null>(null);
  const [signataire, setSignataire] = useState<string | null>(null);
  const [echecDeLecture, setEchecDeLecture] = useState<string | null>(null);
  const [essai, setEssai] = useState(0);

  const [enCours, setEnCours] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echecDuGeste, setEchecDuGeste] = useState<string | null>(null);
  /* CE QU'ON VIENT DE RETIRER, pour pouvoir le remettre. Une fois la note
     partie, le serveur ne la porte plus : sans ce souvenir, rallumer
     l'interrupteur ne saurait quoi réécrire, et l'on retomberait sur le nom du
     compte — c'est-à-dire qu'on perdrait une note personnalisée en la
     décochant puis la recochant. */
  const [noteRetiree, setNoteRetiree] = useState<string | null>(null);

  const [options, setOptions] = useState<StudioOptions | null>(null);
  const [selection, setSelection] = useState<StudioSelection>({});
  const [solde, setSolde] = useState<number | null>(null);
  const [confirmeLaRelance, setConfirmeLaRelance] = useState(false);
  /* La génération lancée par « Refaire ». L'écran la suit lui-même : §3.7
     n'observe que le MESSAGE — « le portrait est une image qui vit en §3.22 » —
     et l'y envoyer ferait tourner sa roue pour toujours. */
  const [enProduction, setEnProduction] = useState<string | null>(null);
  /* Le serveur a dit que la nature n'était pas ouverte. On ne repropose plus le
     geste : chaque nouvelle tentative rouvrirait une feuille qui annonce un
     prix, donc promet un débit, pour un lancement déjà écarté. */
  const [productionRefusee, setProductionRefusee] = useState(false);

  const sors = useCallback((): void => {
    if (routeur.canGoBack()) routeur.back();
    else routeur.replace("/(app)/accueil");
  }, [routeur]);

  /* LE PORTRAIT D'ABORD, LE SIGNATAIRE ENSUITE — et le second n'a pas le droit
     de faire échouer le premier. Le nom du compte ne sert qu'à écrire l'aide de
     la signature et à la remettre quand il ne reste rien : un profil
     indisponible ne doit pas laisser l'écran en rouge sur un portrait qui, lui,
     est arrivé. */
  useEffect(() => {
    if (!chemin) return;
    let vivant = true;
    void (async () => {
      try {
        const lu = portraitSchema.parse(await appel<unknown>(chemin));
        if (!vivant) return;
        setPortrait(lu);
        setEchecDeLecture(null);
      } catch (e) {
        if (vivant) setEchecDeLecture(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
      }
    })();
    void (async () => {
      try {
        const moi = profileSchema.parse(await appel<unknown>("/me/profile"));
        // Sans nom affiché, le pseudo : « Fait avec soin par » tout court se
        // lirait comme une panne, pas comme une absence de réglage.
        if (vivant) setSignataire(moi.displayName ?? moi.username);
      } catch { /* La signature se passera de son repli. */ }
    })();
    return () => { vivant = false; };
  }, [chemin, langue, essai]);

  const etat = portrait ? etatDuPortrait(portrait) : null;
  const cout = coutDe(prix, "portrait");
  const catalogue = options?.catalogue ?? null;
  /* CINQ RAISONS DE NE PAS OFFRIR « REFAIRE », et l'écran se tait plutôt que de
     griser : le drapeau éteint, le catalogue non servi (aucune configuration en
     service — le chemin rend alors 422), le prix absent, et le serveur qui
     vient de refuser la nature. Un bouton qui échouerait vaut moins que pas de
     bouton, et un bouton gris ne dirait pas davantage pourquoi. */
  const peutRefaire = offreDeRefaire(actives) && catalogue !== null && cout !== null
    && !productionRefusee;

  /* Le catalogue n'est lu QUE si le drapeau l'autorise. Sans cette garde, un
     lien profond ouvrirait cet écran drapeau éteint, appellerait un chemin que
     le serveur ferme par `@Feature`, recevrait un 404 et l'afficherait comme
     une panne — sur un compte parfaitement sain. `gouvernee` dit à la couche
     d'appel que ce 404 est un drapeau qui a bougé, pas une ressource absente. */
  useEffect(() => {
    if (!offreDeRefaire(actives)) return;
    let vivant = true;
    void (async () => {
      try {
        const lu = studioOptionsSchema.parse(await appel<unknown>("/me/studio/options", { gouvernee: true }));
        if (!vivant) return;
        setOptions(lu);
        setSelection(selectionParDefaut(lu.catalogue));
      } catch { /* Pas de catalogue, pas de « Refaire » : voir `peutRefaire`. */ }
    })();
    return () => { vivant = false; };
  }, [actives]);

  /* Le solde n'est lu QUE si une feuille va l'annoncer, et une seule fois :
     l'aller chercher au moment du geste ferait attendre devant une question
     qu'on vient de poser. */
  useEffect(() => {
    if (!peutRefaire || solde !== null) return;
    let vivant = true;
    void (async () => {
      try {
        const lu = creditBalanceSchema.parse(await appel<unknown>("/me/credits"));
        if (vivant) setSolde(lu.balance);
      } catch { /* Sans solde, pas de feuille — donc pas de confirmation. */ }
    })();
    return () => { vivant = false; };
  }, [peutRefaire, solde]);

  /* LE SONDAGE VIT DANS L'EFFET, pas dans l'état : un compteur de tours en
     `useState` relancerait l'effet à chaque tour, donc annulerait le minuteur
     qu'il vient de poser — la boucle se déroulerait deux fois, puis quatre.
     Les délais sont ceux de §3.7, déjà éprouvés : deux secondes, puis on double
     jusqu'à huit. */
  useEffect(() => {
    if (!enProduction) return;
    let vivant = true;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    let tours = 0;

    const tourne = async (): Promise<void> => {
      try {
        const lu = generationResultSchema.parse(await appel<unknown>(`/me/generations/${enProduction}`));
        if (!vivant) return;
        if (doitInterroger(lu.generation.status)) {
          minuteur = setTimeout(() => { void tourne(); }, delaiAvantLaProchaine(tours));
          tours += 1;
          return;
        }
        setEnProduction(null);
        /* `resultId` porte le portrait produit. On REMPLACE plutôt qu'on
           n'empile : revenir en arrière sur un portrait qu'on vient de refaire
           n'a pas de sens, et le geste ramènerait sur l'ancien comme s'il était
           encore le résultat courant. */
        if (lu.generation.status === "succeeded" && lu.generation.resultId) {
          setPortrait(null);
          routeur.replace({
            pathname: "/portrait",
            params: qui === undefined
              ? { id: lu.generation.resultId }
              : { id: lu.generation.resultId, qui },
          });
          return;
        }
        /* Aboutir sans résultat, ou échouer : dans les deux cas il n'y a rien de
           neuf à montrer. On le dit en accusé et on garde le portrait qu'on
           avait sous les yeux — le faire disparaître punirait deux fois. */
        setEchecDuGeste(t.genErreurTitre);
      } catch (e) {
        if (!vivant) return;
        setEnProduction(null);
        setEchecDuGeste(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
      }
    };

    void tourne();
    return () => {
      vivant = false;
      if (minuteur) clearTimeout(minuteur);
    };
  }, [enProduction, langue, qui, routeur, t]);

  const patche = async (envoi: { chemin: string; corps: unknown }): Promise<boolean> => {
    setEnCours(true);
    try {
      const neuf = portraitSchema.parse(await appel<unknown>(envoi.chemin, {
        method: "PATCH",
        body: JSON.stringify(envoi.corps),
      }));
      setPortrait(neuf);
      setEchecDuGeste(null);
      return true;
    } catch (e) {
      setEchecDuGeste(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
      return false;
    } finally {
      setEnCours(false);
    }
  };

  const approuve = async (): Promise<void> => {
    if (!portrait) return;
    const envoi = approbation(portrait);
    if (!envoi) return;
    if (await patche(envoi)) setAccuse(t.portraitApprouveFait);
  };

  /* L'INTERRUPTEUR NE FAIT QUE RETIRER ET REMETTRE. La note se rédige au studio
     — « courte, discrète, proposée puis modifiable » —, elle ne se réécrit pas
     ici : §3.22 ne liste pas la saisie parmi ses gestes, et un champ de plus
     ferait de l'aperçu un second formulaire. */
  const basculeLaSignature = async (voulue: boolean): Promise<void> => {
    if (!portrait) return;
    if (!voulue) setNoteRetiree(portrait.senderNote);
    const cible = voulue
      ? signatureARemettre(portrait, noteRetiree, t.portraitNote(signataire ?? ""))
      : null;
    const envoi = changementDeSignature(portrait, cible);
    if (envoi) await patche(envoi);
  };

  /* LA FEUILLE DU TÉLÉPHONE FAIT LES DEUX — §3.22 range « partager » et
     « enregistrer » au même endroit, et c'est exact : le système y pose
     « Enregistrer l'image » à côté des messageries. Ce qui les distingue, c'est
     la charge : l'enregistrement ne joint aucun mot. */
  const ouvreLaFeuille = async (sorte: "enregistrer" | "partager"): Promise<void> => {
    if (!portrait) return;
    const feuille = feuilleDePartage(portrait, sorte, motDAccompagnement(portrait), PLATEFORME);
    if (!feuille) return;
    try {
      /* Les deux formes que `ShareContent` accepte, et pas une de plus : y
         glisser `url` là où le système ne le lit pas ouvrirait une feuille vide
         sans le dire. C'est `feuilleDePartage` qui a tranché ; ici on applique. */
      await Share.share(feuille.sorte === "adresse"
        ? { message: feuille.message }
        : feuille.message === undefined
          ? { url: feuille.url }
          : { url: feuille.url, message: feuille.message });
      /* On accuse l'OUVERTURE de la feuille, pas l'enregistrement : le système
         ne dit pas ce que la personne y a choisi, et l'affirmer serait une
         preuve qu'on n'a pas. C'est la même retenue que `markSent` en §3.7. */
      if (sorte === "enregistrer") setAccuse(t.portraitEnregistreFait);
    } catch (e) {
      setEchecDuGeste(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  const refais = async (): Promise<void> => {
    if (!portrait || !catalogue) return;
    const envoi = relanceDuPortrait(portrait.personId, catalogue, selection);
    if (!envoi) return;
    setEnCours(true);
    setEchecDuGeste(null);
    try {
      const lu = generationResultSchema.parse(await appel<unknown>(envoi.chemin, {
        method: "POST",
        body: JSON.stringify(envoi.corps),
        gouvernee: true,
      }));
      setEnProduction(lu.generation.id);
    } catch (e) {
      const erreur = e instanceof ErreurDApi ? e : null;
      /* « LA NATURE N'EST PAS OUVERTE » N'EST PAS UN ACCIDENT. Le serveur
         n'accepte aujourd'hui que le message : il écarte le portrait par
         `resource_inactive`, AVANT tout débit — rien n'a été prélevé, et il n'y
         a rien à réessayer. On retire l'offre pour de bon plutôt que de laisser
         quelqu'un repasser par une feuille qui annonce un prix. */
      if (laProductionEstRefusee(erreur?.code ?? null)) setProductionRefusee(true);
      setEchecDuGeste(messageDErreur(erreur?.enveloppe ?? null, langue));
    } finally {
      setEnCours(false);
    }
  };

  const retour = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.retour}
      onPress={sors}
      style={styles.retour}
    >
      <Icon name="chevron-left" size={22} color={couleurs.textBody} />
    </Pressable>
  );

  const enveloppe = (contenu: React.ReactNode) => (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={{
        paddingTop: insets.top + nativeSpace[12],
        paddingBottom: insets.bottom + nativeSpace[24],
        paddingHorizontal: nativeSpace[16],
        flexGrow: 1,
      }}
    >
      {retour}
      {contenu}
    </ScrollView>
  );

  /* ARRIVER SANS PORTRAIT N'EST PAS UNE PANNE. On y vient depuis la collection
     d'un proche qui n'en a encore aucun, ou par un lien qui ne désigne rien :
     dans les deux cas la vérité est « il n'y en a pas », et non « ça a raté ».
     La maquette le dessine ainsi, et la copie l'écrit déjà. */
  if (ouvre.sorte === "sans-objet") {
    return enveloppe(
      <View style={styles.centre}>
        <EmptyState
          illustration="portrait-aucun"
          title={t.portraitAucunTitre}
          text={t.portraitAucunTexte}
        />
      </View>,
    );
  }

  if (echecDeLecture && !portrait) {
    return enveloppe(
      <View style={styles.bloc}>
        <Banner intent="error">{echecDeLecture}</Banner>
        <Button variant="outline" full icon="refresh-cw" onPress={() => setEssai((n) => n + 1)}>
          {t.maintReessayer}
        </Button>
      </View>,
    );
  }

  if (!portrait || !etat) {
    return enveloppe(<LoadingState variant="generation" title={t.chargement} />);
  }

  const avecSignature = portrait.senderNote !== null;
  const groupes = catalogue ? groupesAtteignables(catalogue, selection) : [];
  const parId = new Map((catalogue?.groups ?? []).map((g) => [g.id, g]));

  return (
    <View style={{ flex: 1 }}>
      {enveloppe(
        <>
          {/* L'ÉTAT SE DIT EN HAUT, avant l'image : c'est lui qui explique
              pourquoi les gestes du bas ne sont pas ceux qu'on attendait. */}
          {etat === "avalider" ? (
            <View style={styles.declare}>
              <Icon name="eye" size={13} strokeWidth={2} color={couleurs.feedbackWarning} />
              <Text style={[styles.declareTexte, { color: couleurs.feedbackWarning }]}>
                {t.portraitAValider}
              </Text>
            </View>
          ) : null}

          {etat === "pret" && portrait.imageUrl ? (
            /* L'IMAGE TELLE QU'ELLE PARTIRA, pied de marque compris : il fait
               partie du fichier, c'est ce qui fait connaître Lehno quand le
               portrait circule. Le format de référence est le carré (1080 ×
               1080) ; `contain` plutôt que `cover` pour qu'un vertical ne soit
               pas rogné de sa bande — c'est elle qui porte le message. */
            <Image
              accessibilityRole="image"
              accessibilityLabel={portrait.content}
              source={{ uri: portrait.imageUrl }}
              resizeMode="contain"
              style={[styles.image, { backgroundColor: couleurs.surfacePanel }]}
            />
          ) : etat === "composition" ? (
            /* L'image se compose À L'APPROBATION : entre les deux, il y a un
               instant où le portrait est validé et n'a rien à montrer. Le
               traiter comme « prêt » afficherait un cadre vide. */
            <LoadingState variant="generation" title={t.chargement} />
          ) : (
            /* CE QUI ENTRERA DANS LA BANDE, dans l'ordre du gabarit : le nom du
               proche, le message, la note de l'expéditeur. On ne dessine pas le
               gabarit — l'assemblage appartient au serveur — on montre ce qu'on
               s'apprête à faire composer. */
            <Card>
              {qui ? (
                <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>{qui}</Text>
              ) : null}
              <Text style={[styles.message, { color: couleurs.textBody }]}>{portrait.content}</Text>
              {portrait.senderNote ? (
                <Text style={[styles.note, { color: couleurs.textMention }]}>{portrait.senderNote}</Text>
              ) : null}
            </Card>
          )}

          {/* LES PASTILLES RÈGLENT LA PROCHAINE PRODUCTION, pas celle-ci. Elles
              ne paraissent donc qu'avec « Refaire » : seules, elles
              promettraient de rehabiller l'image sous les yeux — ce que ni le
              contrat ni le serveur ne permettent. */}
          {peutRefaire && catalogue
            ? groupes.map((groupId) => {
              const groupe = parId.get(groupId);
              if (!groupe) return null;
              return (
                <View key={groupId} style={styles.bloc}>
                  {/* Le libellé vient du SERVEUR : « les libellés arrivent déjà
                      résolus dans la langue demandée ». Le prendre au
                      dictionnaire embarqué rendrait muette toute option ajoutée
                      en administration, sur tout un parc. */}
                  <SectionLabel>{groupe.label}</SectionLabel>
                  <Choix
                    options={groupe.choices.map((c) => c.id)}
                    libelle={(cle) => groupe.choices.find((c) => c.id === cle)?.label ?? cle}
                    valeur={selection[groupId] ?? null}
                    /* `Choix` retire la valeur quand on réappuie dessus — ce
                       qui vaut pour un champ facultatif, jamais pour un groupe
                       du studio : chacun porte un défaut, et « aucune réponse »
                       rendrait la demande incomplète sans que rien à l'écran ne
                       le dise. On ignore donc le retrait. */
                    pose={(cle) => {
                      if (cle) setSelection((v) => apresLeChoix(catalogue, v, groupId, cle));
                    }}
                  />
                  {/* L'avertissement s'affiche AU MOMENT DU CHOIX, pas après la
                      génération : « l'hommage change le gabarit, et l'apprendre
                      trop tard fait perdre un crédit ». */}
                  {groupe.choices.find((c) => c.id === selection[groupId])?.warning ? (
                    <Banner intent="info">
                      {groupe.choices.find((c) => c.id === selection[groupId])!.warning!}
                    </Banner>
                  ) : null}
                </View>
              );
            })
            : null}

          {/* LA DATE ACCOMPAGNE L'IMAGE : sans elle, deux portraits de la même
              personne sont indistinguables dans sa collection. La PLAGE de
              notes, que la maquette met à côté, n'est pas là — `portraitSchema`
              ne porte ni `sourceFrom` ni `sourceTo`, et l'inventer serait
              annoncer une provenance qu'on ne connaît pas. */}
          <Provenance origin={null} date={dateCourte(portrait.createdAt.slice(0, 10), langue)} />

          <View style={styles.gestes}>
            {etat === "avalider" ? (
              /* L'APPROBATION EST LE GESTE MIS EN AVANT : c'est elle qui
                 déclenche la composition de l'image, donc tout le reste. */
              <Button full icon="check" disabled={enCours} onPress={() => void approuve()}>
                {t.portraitApprouver}
              </Button>
            ) : (
              <>
                {/* « ENREGISTRER » N'EXISTE QUE LÀ OÙ IL PEUT ABOUTIR. La
                    feuille du système ne dépose un fichier que sur iOS ;
                    ailleurs l'appui ouvrirait une feuille vide, sans erreur et
                    sans image. Un geste muet est pire qu'un geste absent, et le
                    rendre gris ne dirait pas davantage pourquoi. */}
                {laFeuilleDeposeUnFichier(PLATEFORME) ? (
                  <Button
                    full
                    icon="download"
                    disabled={enCours || etat !== "pret"}
                    onPress={() => void ouvreLaFeuille("enregistrer")}
                  >
                    {t.portraitEnregistrer}
                  </Button>
                ) : null}
                <Button
                  full
                  variant={laFeuilleDeposeUnFichier(PLATEFORME) ? "outline" : "primary"}
                  icon="share-2"
                  disabled={enCours || etat !== "pret"}
                  onPress={() => void ouvreLaFeuille("partager")}
                >
                  {t.portraitPartagerDehors}
                </Button>
              </>
            )}

            {/* « REFAIRE » JETTE CELUI-CI POUR EN REDEMANDER UN AUTRE, et le
                paie. Il vient donc en dernier, après les gestes gratuits, et
                s'annonce par une feuille : rien ne se paie en silence. */}
            {peutRefaire ? (
              <Button
                full
                variant="text"
                icon="refresh-cw"
                disabled={enCours || enProduction !== null}
                onPress={() => setConfirmeLaRelance(true)}
              >
                {t.resRegenerer}
              </Button>
            ) : null}
          </View>

          {/* Pas de mention « sur votre Mur » : le portrait n'y va pas. */}
          <View style={[styles.pied, { borderTopColor: couleurs.borderHairline }]}>
            <Bascule
              premier
              libelle={t.portraitSignature}
              actif={avecSignature}
              onBascule={(v) => void basculeLaSignature(v)}
            />
            <Text style={[styles.aide, { color: couleurs.textMention }]}>
              {t.portraitSignatureAide(signataire ?? t.portraitSignature2)}
            </Text>
          </View>

          {/* Ce qui a été dépensé, dit après coup. Toujours : il n'y a pas de
              mode gratuit à ménager, le crédit se consomme quoi qu'il arrive. */}
          {cout !== null ? (
            <CreditIndicator label={t.creditDepense(cout)} cost={cout} />
          ) : null}
        </>,
      )}

      {/* La feuille n'ouvre que si tout ce qu'elle doit annoncer est là : un
          prix servi et un solde lu. Une confirmation qui devinerait l'un des
          deux annoncerait un chiffre que le débit démentirait. */}
      {confirmeLaRelance && cout !== null && solde !== null ? (
        <PaidActionSheet
          surTitre={qui === undefined ? t.prepPortraitTitre : t.prepPour(qui)}
          titre={t.prepPortraitTitre}
          resultat={t.prepPortraitTexte}
          coutLibelle={t.creditUnite(cout)}
          soldeLibelle={t.creditReste(solde)}
          lancer={t.feuilleLancer}
          recharger={t.feuilleRecharger}
          pasMaintenant={t.feuillePasMaintenant}
          cout={cout}
          solde={solde}
          insetBas={insets.bottom}
          onConfirmer={() => { setConfirmeLaRelance(false); void refais(); }}
          onRecharger={() => { setConfirmeLaRelance(false); routeur.push("/(app)/recharge"); }}
          onAnnuler={() => setConfirmeLaRelance(false)}
        />
      ) : null}

      {/* Les accusés se posent au bas de l'ÉCRAN, pas au bas de la liste : en
          natif il n'y a pas de `position: fixed`, donc c'est le parent qui les
          monte au bon niveau — sinon ils défileraient avec le contenu. */}
      {echecDuGeste ? (
        <Toast intent="error" insetBas={insets.bottom} onDismiss={() => setEchecDuGeste(null)}>
          {echecDuGeste}
        </Toast>
      ) : accuse ? (
        <Toast intent="success" insetBas={insets.bottom} onDismiss={() => setAccuse(null)}>
          {accuse}
        </Toast>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  bloc: { gap: nativeSpace[8], marginTop: nativeSpace[16] },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", aspectRatio: 1, borderRadius: nativeRadius.xl },
  nom: {
    fontFamily: nativeFont.displayMedium, fontSize: 19,
    letterSpacing: nativeLetterSpacing(19, nativeTracking.display),
  },
  message: { fontFamily: nativeFont.bodyRegular, fontSize: 15, lineHeight: 23, marginTop: nativeSpace[8] },
  note: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[12] },
  declare: { flexDirection: "row", alignItems: "center", gap: nativeSpace[6], marginBottom: nativeSpace[10] },
  declareTexte: {
    fontFamily: nativeFont.bodySemibold, fontSize: 11, textTransform: "uppercase",
    letterSpacing: nativeLetterSpacing(11, nativeTracking.kicker),
  },
  gestes: { gap: nativeSpace[8], marginTop: nativeSpace[20] },
  pied: { marginTop: nativeSpace[24], paddingTop: nativeSpace[16], borderTopWidth: 1 },
  aide: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, lineHeight: 19 },
});

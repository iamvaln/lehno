import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  creditBalanceSchema, generatedMessageSchema, generationResultSchema,
  type GenerationResult,
} from "@lehno/contracts";
import {
  nativeFont, nativeLetterSpacing, nativeSpace, nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Banner, Button, Card, CreditIndicator, Icon, Illustration, LoadingState,
  PaidActionSheet, Provenance, Quote, TextField, Toast, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../lib/langue.js";
import { appel, ErreurDApi } from "../lib/api.js";
import { messageDErreur } from "../lib/session.js";
import { useDrapeaux } from "../lib/DrapeauxProvider.js";
import { dateCourte } from "../lib/carnet.js";
import {
  correctionDuMessage, creditRendu, delaiAvantLaProchaine, doitInterroger,
  marquageEnvoye, montreLeCout, offreDeRefaire, ouverture, phaseDuResultat,
  relanceDuMessage,
} from "../lib/generation.js";
import { useActionsPayantes } from "../lib/MetadonneesProvider.js";
import { coutDe, passeParLaFeuille } from "../lib/preparation.js";

/* « Ce que Lehno a écrit » — §3.7, le résultat d'une génération.
 *
 * DEUX MOMENTS DU MÊME ÉCRAN. L'attente est soignée parce qu'elle dure ; le
 * résultat est le seul contenu de l'application qui en sorte.
 *
 * L'ATTENTE N'ENFERME PAS (décisions natives §6). La demande est PARTIE quand
 * on arrive ici — c'est la préparation qui l'a lancée et payée. L'écran n'est
 * qu'un observateur : il sonde, il n'appelle jamais `POST /me/generations`.
 * Quitter n'annule donc rien, et le travail se retrouve dans les reprises
 * (§3.16). D'où une SORTIE, jamais une annulation qui mentirait sur ce qu'elle
 * annule — et jamais de relance au montage, qui ferait repayer un retour.
 *
 * C'EST UNE DESTINATION, PAS UNE FEUILLE. On ne revient pas d'un résultat comme
 * on revient d'une saisie : il remplace ce qu'on regardait, et se retrouve
 * ensuite par les reprises ou par l'occasion. Rien à déclarer dans `_layout` —
 * la présentation par défaut de la pile est exactement celle-là.
 *
 * LE MESSAGE, ET LUI SEUL. `generationResultSchema` ne porte qu'un `message` :
 * les idées n'ont pas encore de résultat au contrat, et le portrait est une
 * image qui vit en §3.22. Le kit dessine les trois ; on ne rend que celui dont
 * le contrat parle.
 *
 * DEUX ÉCHECS, PAS UN. La LECTURE qui échoue prend tout l'écran, avec une
 * sortie : sans cela la roue tournerait pour toujours, ce qui nous est déjà
 * arrivé. Le GESTE qui échoue — un ajustement, un marquage — se dit en accusé,
 * parce que le texte est toujours là et qu'il ne doit pas disparaître avec le
 * message d'erreur.
 */

/* « REFAIRE » ET « RÉESSAYER » SONT LE MÊME GESTE : une NOUVELLE demande, donc
 * un nouveau crédit. Ils ne diffèrent que par ce qu'on avait sous les yeux —
 * un texte qu'on n'aime pas, ou une écriture qui n'a pas abouti.
 *
 * Le geste ne part donc jamais nu : le coût s'annonce sur place et se
 * confirme, avec le solde à côté. C'est ce que la feuille de §3.7 fait déjà en
 * amont, et c'est la même ici — un bouton qui débiterait sans rien dire
 * romprait « rien ne se paie en silence ».
 *
 * QUATRE RAISONS DE NE PAS L'OFFRIR, et l'écran se tait plutôt que de griser :
 * le drapeau `generation.message` éteint, l'occasion inconnue (on ne saurait
 * pas quoi redemander), le prix non servi (l'action n'est pas disponible), et
 * — cas du lancement — l'achat éteint, où il n'y a rien à confirmer et le
 * geste part directement.
 */

export default function Generation() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();
  const prix = useActionsPayantes();
  /* Rien ne se paie quand l'achat est éteint : ni feuille, ni solde à lire. */
  const avecFeuille = passeParLaFeuille(actives);
  /* `id` : la génération à observer, déjà lancée. `qui` : le nom d'usage du
     proche, que l'appelant connaît — l'accusé d'envoi le nomme, et aller le
     rechercher ferait un appel pour une phrase. */
  const { id, qui } = useLocalSearchParams<{ id?: string; qui?: string }>();

  const ouvre = useMemo(() => ouverture(id), [id]);

  const [resultat, setResultat] = useState<GenerationResult | null>(null);
  const [echecDeLecture, setEchecDeLecture] = useState<string | null>(null);
  const [essai, setEssai] = useState(0);

  const [ajuste, setAjuste] = useState(false);
  const [brouillon, setBrouillon] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echecDuGeste, setEchecDuGeste] = useState<string | null>(null);
  const [confirmeLaRelance, setConfirmeLaRelance] = useState(false);
  const [solde, setSolde] = useState<number | null>(null);

  const chemin = ouvre.sorte === "observer" ? ouvre.chemin : null;

  /* LE SONDAGE VIT DANS L'EFFET, pas dans l'état. Un compteur de tours en
     `useState` relancerait l'effet à chaque tour, donc annulerait le minuteur
     qu'il vient de poser : la boucle se déroulerait deux fois, puis quatre. Ici
     il est local, et le nettoyage l'arrête pour de bon quand on quitte. */
  useEffect(() => {
    if (!chemin) return;
    let vivant = true;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    let tours = 0;

    const tourne = async (): Promise<void> => {
      try {
        const brut = await appel<unknown>(chemin);
        if (!vivant) return;
        const lu = generationResultSchema.parse(brut);
        setResultat(lu);
        setEchecDeLecture(null);
        if (doitInterroger(lu.generation.status)) {
          minuteur = setTimeout(() => { void tourne(); }, delaiAvantLaProchaine(tours));
          tours += 1;
        }
      } catch (e) {
        if (!vivant) return;
        setEchecDeLecture(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
      }
    };

    void tourne();
    return () => {
      vivant = false;
      if (minuteur) clearTimeout(minuteur);
    };
  }, [chemin, langue, essai]);

  /* Un retour ORDINAIRE — c'est ce que §6 demande, et c'est ce qui rend
     « vous pouvez fermer » vrai. En arrivée directe (notification, lien), il
     n'y a rien derrière : on repose alors l'accueil plutôt que de laisser
     quelqu'un sans issue. */
  const sors = useCallback((): void => {
    if (routeur.canGoBack()) routeur.back();
    else routeur.replace("/(app)/accueil");
  }, [routeur]);

  /* Arriver ici sans identifiant n'est pas un état à dessiner : c'est une
     navigation qui n'aurait pas dû partir. On ne LANCE surtout pas une
     génération pour se donner quelque chose à montrer — ce serait un crédit
     débité que personne n'a demandé. */
  useEffect(() => {
    if (ouvre.sorte === "sans-objet") sors();
  }, [ouvre.sorte, sors]);

  const message = resultat?.message ?? null;
  const phase = phaseDuResultat(resultat);

  /* CE QU'IL FAUT POUR REDEMANDER : l'occasion visée. Elle vient de
     l'EXÉCUTION, connue dès le lancement — la lire sur le message produit ne
     marcherait pas ici, puisqu'un échec n'en produit aucun, et c'est justement
     l'échec qui offre « Réessayer ». */
  const relance = relanceDuMessage(resultat?.generation.occurrenceId ?? undefined);
  const cout = coutDe(prix, "wish_message");
  const peutRefaire = offreDeRefaire(actives) && relance !== null && cout !== null;

  /* Le solde n'est lu QUE si une feuille va l'annoncer, et une seule fois :
     l'aller chercher au moment du geste ferait attendre devant une question
     qu'on vient de poser, et le chercher toujours ferait un appel pour un
     bouton qui n'apparaît pas. */
  useEffect(() => {
    if (!peutRefaire || !avecFeuille || solde !== null) return;
    let vivant = true;
    void (async () => {
      try {
        const lu = creditBalanceSchema.parse(await appel<unknown>("/me/credits"));
        if (vivant) setSolde(lu.balance);
      } catch {
        /* Sans solde, pas de feuille — donc pas de bouton. Le silence vaut
           mieux qu'une confirmation qui annoncerait un reste inventé. */
      }
    })();
    return () => { vivant = false; };
  }, [peutRefaire, avecFeuille, solde]);

  /* REDEMANDER, c'est repartir de zéro sur la même occasion : nouvelle
     exécution, nouveau crédit, et l'écran suit la nouvelle plutôt que de
     rester sur l'ancienne. `replace` et non `push` — revenir en arrière sur
     une génération qu'on vient de refaire n'a pas de sens.
     La clé d'idempotence rend deux appuis maladroits reconnaissables comme
     une seule demande ; sans elle, deux débits. */
  const refais = async (): Promise<void> => {
    if (!relance) return;
    setEnCours(true);
    setEchecDuGeste(null);
    try {
      const brut = await appel<unknown>(relance.chemin, {
        method: "POST",
        body: JSON.stringify(relance.corps),
        gouvernee: true,
      });
      const lu = generationResultSchema.parse(brut);
      routeur.replace({
        pathname: "/generation",
        params: qui === undefined ? { id: lu.generation.id } : { id: lu.generation.id, qui },
      });
    } catch (e) {
      setEchecDuGeste(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnCours(false);
    }
  };

  /* Un seul chemin pour les deux boutons : la feuille quand quelque chose se
     paie, le geste direct sinon. */
  const demandeARefaire = (): void => {
    if (avecFeuille) setConfirmeLaRelance(true);
    else void refais();
  };

  const patche = async (envoi: { chemin: string; corps: unknown }): Promise<boolean> => {
    setEnCours(true);
    try {
      const brut = await appel<unknown>(envoi.chemin, {
        method: "PATCH",
        body: JSON.stringify(envoi.corps),
      });
      const neuf = generatedMessageSchema.parse(brut);
      setResultat((v) => (v ? { ...v, message: neuf } : v));
      setEchecDuGeste(null);
      return true;
    } catch (e) {
      setEchecDuGeste(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
      return false;
    } finally {
      setEnCours(false);
    }
  };

  const garde = async (): Promise<void> => {
    if (!message) return;
    const envoi = correctionDuMessage(message.id, brouillon, message.content);
    /* Rien n'a bougé : on referme sans appeler. « `edited` se pose à la
       première correction et ne se retire plus » — le poser sur un texte
       intact fausserait durablement la seule mesure qui dit si nos brouillons
       tiennent, et ouvrir puis refermer est le geste le plus banal d'ici. */
    if (!envoi) { setAjuste(false); return; }
    if (await patche(envoi)) setAjuste(false);
  };

  /* L'ENVOI EST UNE AFFIRMATION, pas un constat : l'application n'envoie rien
     elle-même, elle ouvre la feuille de partage du téléphone. Refermer cette
     feuille sans rien choisir ne marque donc rien — sur iOS on le sait, et
     marquer là simulerait la preuve d'envoi que le contrat refuse de donner. */
  const envoie = async (): Promise<void> => {
    if (!message) return;
    try {
      const partage = await Share.share({ message: message.content });
      const envoi = marquageEnvoye(message.id, message.status, partage.action);
      if (!envoi) return;
      if (await patche(envoi)) setAccuse(qui ? t.envoiFait(qui) : t.occMessageEnvoye);
    } catch (e) {
      setEchecDuGeste(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: couleurs.surfacePage }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + nativeSpace[12],
          paddingBottom: insets.bottom + nativeSpace[24],
          paddingHorizontal: nativeSpace[16],
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.retour}
          onPress={sors}
          style={styles.retour}
        >
          <Icon name="chevron-left" size={22} color={couleurs.textBody} />
        </Pressable>

        {echecDeLecture ? (
          /* Un chargement qui échoue doit se DIRE, avec une sortie. Sans elle,
             l'écran garderait sa roue pour toujours. */
          <View style={styles.bloc}>
            <Banner intent="error">{echecDeLecture}</Banner>
            <Button
              variant="outline"
              full
              icon="refresh-cw"
              onPress={() => setEssai((n) => n + 1)}
            >
              {t.maintReessayer}
            </Button>
          </View>
        ) : phase === "chargement" ? (
          <LoadingState variant="generation" title={t.chargement} />
        ) : phase === "attente" ? (
          /* L'attente dit combien de temps, et surtout qu'on peut partir.
             « Vous pouvez fermer : ce sera là à votre retour » n'est pas une
             politesse — c'est la promesse que rien ne se perd, et le bouton
             invite à faire autre chose plutôt qu'à retenir. */
          <View style={styles.centre}>
            <Illustration name="generation-en-cours" width={150} />
            <LoadingState
              variant="generation"
              title={t.genAttenteTitre}
              text={t.genAttenteTexte}
              leaveLabel={t.genAttenteQuitter}
              onLeave={sors}
            />
          </View>
        ) : phase === "echec" && resultat ? (
          <View style={styles.bloc}>
            {/* L'échec dit d'abord ce que l'utilisateur veut savoir : son
                crédit n'a pas été prélevé. Mais seulement quand c'est vrai —
                un aboutissement sans contenu l'a bel et bien dépensé, et le
                promettre là se découvrirait sur le solde. */}
            {creditRendu(resultat) ? (
              <Banner intent="error">{t.genErreurTexte}</Banner>
            ) : null}
            <View style={styles.centre}>
              <Illustration name="paiement-echoue" width={140} />
              <Text style={[styles.titreEchec, { color: couleurs.textBody }]} accessibilityRole="header">
                {t.genErreurTitre}
              </Text>
              {/* Réessayer coûte un crédit comme la première fois : c'est une
                  NOUVELLE demande, pas une reprise de celle qui a échoué. Le
                  prix s'annonce donc et se confirme, exactement comme en
                  amont. Sans occasion connue, sans prix servi ou drapeau
                  éteint, l'écran n'offre que sa sortie — mieux qu'un bouton
                  qui échouerait, et pas de bouton grisé. */}
              {peutRefaire ? (
                <Button full icon="refresh-cw" disabled={enCours} onPress={demandeARefaire}>
                  {t.genReessayer}
                </Button>
              ) : null}
              <Button variant="outline" full icon="corner-up-left" onPress={sors}>
                {t.retour}
              </Button>
            </View>
          </View>
        ) : message ? (
          <View style={styles.bloc}>
            <Text style={[styles.titre, { color: couleurs.textBody }]} accessibilityRole="header">
              {t.resMessageTitre}
            </Text>

            {/* Ajuster NE QUITTE PAS L'ÉCRAN : le texte s'ouvre là où on le
                lit, et les actions d'envoi cèdent la place tant qu'on écrit. */}
            {ajuste ? (
              <TextField
                multiline
                autoFocus
                label={t.resAjuster}
                value={brouillon}
                onChangeText={setBrouillon}
              />
            ) : (
              <Card surface="panel" padding={18} radius="lg">
                <Quote size={17}>{message.content}</Quote>
                {/* La provenance ne s'invente pas : le contrat ne dit pas de
                    quelles notes le texte est sorti. On n'affiche que la date
                    de production, qui est une donnée. */}
                <Provenance
                  origin={null}
                  date={dateCourte(message.createdAt.slice(0, 10), langue)}
                />
              </Card>
            )}

            {/* L'état déclaré, quand il l'a été. « Un message envoyé puis
                corrigé reste envoyé » : la ligne ne disparaît pas au premier
                ajustement. */}
            {!ajuste && message.status === "sent" ? (
              <View style={styles.declare}>
                <Icon name="check" size={14} strokeWidth={2} color={couleurs.feedbackSuccess} />
                <Text style={[styles.declareTexte, { color: couleurs.feedbackSuccess }]}>
                  {t.occMessageEnvoye}
                </Text>
              </View>
            ) : null}

            <View style={styles.gestes}>
              {ajuste ? (
                <>
                  <Button full icon="check" disabled={enCours} onPress={() => void garde()}>
                    {t.resAjusteFini}
                  </Button>
                  {/* On revient au texte du SERVEUR — celui qui est enregistré,
                      ajustements précédents compris —, pas à une version qu'on
                      aurait gardée en mémoire. */}
                  <Button
                    full
                    variant="text"
                    disabled={enCours}
                    onPress={() => { setBrouillon(message.content); setAjuste(false); }}
                  >
                    {t.resAjusteAnnuler}
                  </Button>
                </>
              ) : (
                <>
                  <Button full icon="send" disabled={enCours} onPress={() => void envoie()}>
                    {t.resEnvoyerVia}
                  </Button>
                  {/* L'ajustement ne dépend d'AUCUN drapeau : éteindre
                      `generation.message` empêche d'en produire de nouveaux,
                      pas de relire et de corriger ce qu'on a déjà payé. */}
                  <Button
                    full
                    variant="text"
                    icon="pencil"
                    onPress={() => { setBrouillon(message.content); setAjuste(true); }}
                  >
                    {t.resAjuster}
                  </Button>
                  {/* « Refaire » JETTE ce texte-ci pour en redemander un autre,
                      et le paie. Il vient donc après « Ajuster », qui ne coûte
                      rien : le geste gratuit se propose avant le payant. */}
                  {peutRefaire ? (
                    <Button
                      full
                      variant="text"
                      icon="refresh-cw"
                      disabled={enCours}
                      onPress={demandeARefaire}
                    >
                      {t.resRegenerer}
                    </Button>
                  ) : null}
                </>
              )}
            </View>

            {!ajuste ? (
              <Text style={[styles.rappel, { color: couleurs.textMention }]}>{t.envoiRappel}</Text>
            ) : null}

            {/* LE PIÈGE DU BRIEF : l'achat éteint ne ferme pas les
                générations, il les rend gratuites. Un coût rappelé mentirait à
                quelqu'un qui vient de recevoir quelque chose sans payer. */}
            {!ajuste && montreLeCout(actives) ? (
              <CreditIndicator
                label={t.creditDepense(resultat?.generation.creditsSpent ?? 0)}
                cost={resultat?.generation.creditsSpent ?? 0}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Les accusés se posent au bas de l'ÉCRAN, pas au bas de la liste :
          en natif il n'y a pas de `position: fixed`, donc c'est le parent qui
          les monte au bon niveau — sinon ils défileraient avec le texte. */}
      {/* La feuille n'ouvre que si tout ce qu'elle doit annoncer est là : un
          prix servi et un solde lu. Une confirmation qui devinerait l'un des
          deux annoncerait un chiffre que le débit démentirait. */}
      {confirmeLaRelance && cout !== null && solde !== null ? (
        <PaidActionSheet
          surTitre={qui === undefined ? t.resMessageTitre : t.prepPour(qui)}
          titre={t.prepMessageTitre}
          resultat={t.prepMessageTexte}
          coutLibelle={t.creditUnite(cout)}
          soldeLibelle={t.creditReste(solde)}
          lancer={t.feuilleLancer}
          recharger={t.feuilleRecharger}
          pasMaintenant={t.feuillePasMaintenant}
          cout={cout}
          solde={solde}
          insetBas={insets.bottom}
          onConfirmer={() => { setConfirmeLaRelance(false); void refais(); }}
          onAnnuler={() => setConfirmeLaRelance(false)}
        />
      ) : null}

      {echecDuGeste ? (
        <Toast intent="error" insetBas={insets.bottom} onDismiss={() => setEchecDuGeste(null)}>
          {echecDuGeste}
        </Toast>
      ) : accuse ? (
        <Toast intent="success" insetBas={insets.bottom} onDismiss={() => setAccuse(null)}>
          {accuse}
        </Toast>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  retour: {
    width: nativeTouchMin,
    height: nativeTouchMin,
    marginLeft: -nativeSpace[12],
    alignItems: "center",
    justifyContent: "center",
  },
  bloc: { gap: nativeSpace[12] },
  centre: { alignItems: "center", gap: nativeSpace[12] },
  titre: {
    fontFamily: nativeFont.displayRegular,
    fontSize: 22,
    letterSpacing: nativeLetterSpacing(22, nativeTracking.display),
  },
  titreEchec: {
    fontFamily: nativeFont.displayMedium,
    fontSize: 21,
    textAlign: "center",
    letterSpacing: nativeLetterSpacing(21, nativeTracking.display),
  },
  declare: { flexDirection: "row", alignItems: "center", gap: nativeSpace[6] },
  declareTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 13 },
  gestes: { gap: nativeSpace[8], marginTop: nativeSpace[6] },
  rappel: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, lineHeight: 19 },
});

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collectionAccountsSchema, creditBalanceSchema, creditBundlesSchema,
  CREDIT_REASON_LABELS, paymentChannelsSchema, paymentDetailSchema,
  paymentPreviewSchema, paymentsSchema,
  type CollectionAccount, type CreditBundle, type CreditTransaction,
  type PaymentChannel, type PaymentDetail, type PaymentPreview,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeLetterSpacing, nativeRadius, nativeSpace,
  nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Banner, Button, Card, CreditIndicator, Icon, Illustration, LoadingState,
  SectionLabel, TextField, Toast, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { dateCourte } from "../../lib/carnet.js";
import {
  canalPourLeCompte, comptePourVerser, corpsDeDeclaration, declarationComplete,
  montreLeMouvement, mouvementsRecents, moyensDeVersement, offreTout,
  parcoursDeRecharge,
} from "../../lib/versement.js";
import {
  apercuDemandable, corpsDApercu, etapeDeLaRecharge, iconeDuMoyen, montantEnClair,
  natureDeLAttente, paiementASuivre, paiementDuLien, paliersOrdonnes,
  palierParDefaut, recapDuPaiement, rienNAEtePreleve, suivreEncore,
  SUIVI_INTERVALLE_MS,
} from "../../lib/recharge.js";

/* Crédits et recharge — §3.9, le parcours entier.
 *
 * CINQ MOMENTS, ET UN SEUL ÉCRAN. Choisir, relire ce que ça coûte, attendre,
 * aboutir, échouer. Les séparer en cinq routes aurait donné cinq adresses
 * atteignables par lien profond, dont quatre n'ont de sens qu'après la
 * précédente — on serait tombé sur « Crédits ajoutés » sans avoir rien payé.
 * L'étape se déduit donc du PAIEMENT, et `recharge.ts` porte la règle.
 *
 * AU LANCEMENT, L'ORDRE DES GESTES S'INVERSE. `topup.provider` est éteint :
 * aucun opérateur n'encaisse, donc rien ne se pousse sur le téléphone. On verse
 * depuis son application d'opérateur, PUIS on revient déclarer. Le
 * récapitulatif garde tout son sens — c'est même là qu'il en a le plus, puisque
 * le total qu'il annonce est le chiffre à TAPER chez l'opérateur.
 *
 * LES FRAIS NE SE CALCULENT PAS ICI. `/me/payments/preview` les rend, avec le
 * total. Le barème se règle en administration, et une addition locale mentirait
 * au premier changement — devant l'application de l'opérateur, au pire moment.
 *
 * LE COMPTE SUR LEQUEL VERSER EST SERVI, jamais écrit ici, et ses trois champs
 * se lisent ensemble : au moment de valider, l'opérateur affiche le NOM du
 * destinataire, et quelqu'un à qui l'on n'a annoncé que « le compte Lehno » voit
 * s'afficher « ANA KAY » et renonce, croyant s'être trompé.
 */
export default function Recharge() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();
  /* Un lien profond peut poser ce qu'il veut ici — une chaîne, un tableau
     quand le paramètre paraît deux fois, l'identifiant de quelqu'un d'autre.
     `paiementDuLien` ne le croit pas : il le cherche dans la liste servie. */
  const { paiement: demande } = useLocalSearchParams<{ paiement?: string }>();

  const [solde, setSolde] = useState<number | null>(null);
  const [mouvements, setMouvements] = useState<CreditTransaction[]>([]);
  const [paliers, setPaliers] = useState<CreditBundle[]>([]);
  const [comptes, setComptes] = useState<CollectionAccount[]>([]);
  const [canaux, setCanaux] = useState<PaymentChannel[]>([]);

  const [paiement, setPaiement] = useState<PaymentDetail | null>(null);
  const [apercu, setApercu] = useState<PaymentPreview | null>(null);
  const [essais, setEssais] = useState(0);

  const [palier, setPalier] = useState<string | null>(null);
  const [moyen, setMoyen] = useState<string | null>(null);
  const [depuis, setDepuis] = useState("");
  const [reference, setReference] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const parcours = parcoursDeRecharge(actives);
  const manuel = parcours === "manuel";

  /* LA REPRISE N'A LIEU QU'UNE FOIS.
   *
   * `charge` se rejoue quand la langue change, et sans cette garde elle
   * remettrait l'écran sur le paiement servi : quelqu'un en train de relire son
   * récapitulatif se retrouverait renvoyé au choix. Ce que le serveur sait des
   * paiements sert à REPRENDRE une session interrompue, pas à corriger celle
   * qui est en cours. */
  const reprisFait = useRef(false);

  const charge = useCallback(async () => {
    try {
      const credits = creditBalanceSchema.parse(await appel<unknown>("/me/credits"));
      setSolde(credits.balance);
      setMouvements(credits.transactions);

      /* Les paliers sont servis sans garde ; le reste suit `topup.manual`.
         Demander ce que le drapeau ferme rendrait un 404 qu'on afficherait
         comme une panne. */
      const bundles = creditBundlesSchema.parse(
        await appel<unknown>("/me/credit-bundles"),
      ).bundles;
      setPaliers(bundles);
      setPalier((deja) => deja ?? palierParDefaut(bundles));

      if (manuel) {
        const [brutComptes, brutCanaux, brutPaiements] = await Promise.all([
          appel<unknown>("/me/collection-accounts", { gouvernee: true }),
          appel<unknown>("/me/payment-channels", { gouvernee: true }),
          appel<unknown>("/me/payments", { gouvernee: true }),
        ]);
        const lesComptes = collectionAccountsSchema.parse(brutComptes).accounts;
        const lesCanaux = paymentChannelsSchema.parse(brutCanaux).channels;
        setComptes(lesComptes);
        setCanaux(lesCanaux);

        const leCompte = comptePourVerser(lesComptes);
        /* Un seul canal chez l'opérateur du compte : on le pose, il n'y a rien
           à choisir. Plusieurs : on ne pose rien, parce que le barème décide de
           ce qu'on verse en plus et que ce choix-là appartient à la personne. */
        if (leCompte) {
          const seul = canalPourLeCompte(lesCanaux, leCompte);
          if (seul) setMoyen((deja) => deja ?? seul.id);
        }

        const liste = paymentsSchema.parse(brutPaiements).payments;
        if (!reprisFait.current) {
          reprisFait.current = true;
          setPaiement(paiementDuLien(demande, liste) ?? paiementASuivre(liste));
        }
      }
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [demande, langue, manuel]);

  useEffect(() => { void charge(); }, [charge]);

  /* LE SUIVI SE FAIT AU COMPTE-GOUTTES, ET IL S'ARRÊTE.
   *
   * Une demande poussée aboutit en une à deux minutes — c'est ce que la copie
   * annonce — ou expire. Une vérification humaine se compte en heures, et
   * l'écran dit qu'il n'y a plus rien à faire : continuer à interroger le
   * serveur toutes les quatre secondes viderait la batterie sur un écran qui
   * vient de dire qu'on peut le fermer. `suivreEncore` porte la borne. */
  const relit = useCallback(async (id: string): Promise<void> => {
    try {
      const lu = paymentDetailSchema.parse(
        await appel<unknown>("/me/payments/" + id, { gouvernee: true }),
      );
      setPaiement(lu);
      if (lu.status === "succeeded") {
        const credits = creditBalanceSchema.parse(await appel<unknown>("/me/credits"));
        setSolde(credits.balance);
        setMouvements(credits.transactions);
      }
    } catch {
      /* Un suivi qui échoue n'est PAS une panne de l'écran : le paiement reste
         ce qu'il était, et le bandeau rouge ferait croire que le versement a
         mal tourné. On compte l'essai, et on retentera. */
    } finally {
      setEssais((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    if (paiement === null || !suivreEncore(paiement.status, essais)) return;
    const minuteur = setTimeout(() => { void relit(paiement.id); }, SUIVI_INTERVALLE_MS);
    return () => clearTimeout(minuteur);
  }, [essais, paiement, relit]);

  const compte = comptePourVerser(comptes);
  const moyens = compte ? moyensDeVersement(canaux, compte) : [];
  const canal = moyens.find((c) => c.id === moyen) ?? null;
  const choisi = paliersOrdonnes(paliers).find((p) => p.id === palier) ?? null;
  const etape = etapeDeLaRecharge(paiement, apercu);

  const demandeApercu = async (): Promise<void> => {
    if (!apercuDemandable(palier, moyen)) return;
    setEnvoi(true);
    setEchec(null);
    try {
      setApercu(paymentPreviewSchema.parse(await appel<unknown>("/me/payments/preview", {
        method: "POST",
        gouvernee: true,
        body: JSON.stringify(corpsDApercu(palier!, moyen!)),
      })));
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  const declare = async (): Promise<void> => {
    if (!compte || !canal || !palier) return;
    setEnvoi(true);
    setEchec(null);
    try {
      const depose = paymentDetailSchema.parse(await appel<unknown>("/me/payments", {
        method: "POST",
        gouvernee: true,
        body: JSON.stringify(corpsDeDeclaration({
          palier, canal: canal.id, compte: compte.id, depuis, reference,
        })),
      }));
      /* L'APERÇU PART AVEC LA DÉCLARATION. Il a servi à décider ; le paiement
         porte désormais ses propres montants, figés. Le garder ferait deux
         vérités sur le même achat, et c'est celle de l'écran qui aurait
         vieilli. */
      setApercu(null);
      setEssais(0);
      setPaiement(depose);
      setAccuse(t.versementDeclare);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  /* On revient au choix en gardant le palier et le moyen : après un refus, on
     réessaie le même achat neuf fois sur dix, et le refaire choisir donnerait
     l'impression que le premier n'a pas compté. */
  const recommence = (): void => {
    setPaiement(null);
    setApercu(null);
    setEssais(0);
    setDepuis("");
    setReference("");
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

  if (echec && solde === null) {
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

  if (solde === null) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + nativeSpace[20] }]}>
        <LoadingState variant="liste" rows={4} title={t.chargement} />
      </View>
    );
  }

  const issue = (dedans: ReactNode) => (
    <View
      style={[styles.issue, {
        backgroundColor: couleurs.surfacePage,
        paddingTop: insets.top + nativeSpace[24],
        paddingBottom: insets.bottom + nativeSpace[20],
      }]}
    >
      {dedans}
    </View>
  );

  /* L'ATTENTE — le moment le plus inquiétant du produit : on ne sait pas si son
     argent est parti. L'écran dit donc exactement où regarder.

     ET IL NE DIT PAS LA MÊME CHOSE DANS LES DEUX PARCOURS. Une demande poussée
     s'affiche sur le téléphone et expire seule ; un versement déclaré attend un
     humain, et rien n'expirera. Servir la copie de la maquette à quelqu'un qui
     a déjà versé lui ferait guetter une notification qui ne viendra jamais.
     `natureDeLAttente` lit le MODE DU PAIEMENT, jamais le drapeau du jour : un
     drapeau bascule pendant qu'un versement dort en attente. */
  if (etape === "attente" && paiement) {
    const poussee = natureDeLAttente(paiement.mode) === "poussee";
    const rappel = paiement.collectionAccount;
    return issue(
      <>
        <Illustration name="paiement-attente" width={144} />
        <View style={[styles.badge, { backgroundColor: couleurs.actionQuietBg }]}>
          <Icon name="loader" size={14} color={couleurs.textAccent} />
          <Text style={[styles.badgeTexte, { color: couleurs.textAccent }]}>
            {t.rechargeAttenteEnCours}
          </Text>
        </View>
        <Text style={[styles.grandTitre, { color: couleurs.textBody }]}>
          {poussee ? t.rechargeAttenteTitre : t.versementDeclare}
        </Text>
        <Text style={[styles.chapeau, { color: couleurs.textSecondary }]}>
          {poussee ? t.rechargeAttenteTexte : t.versementDeclareTexte}
        </Text>

        {/* OÙ L'ARGENT EST PARTI, rappelé sur l'écran d'attente. Le contrat sert
            `collectionAccount` sur le paiement exprès pour ça : c'est ce qu'on
            vient revérifier quand on doute d'avoir visé le bon numéro. */}
        {!poussee && rappel ? (
          <Card surface="panel" padding={15} radius="lg" style={styles.rappel}>
            <Text style={[styles.mention, { color: couleurs.textSecondary }]}>
              {t.versementNumero}
            </Text>
            <Text selectable style={[styles.numero, { color: couleurs.textBody }]}>
              {rappel.number}
            </Text>
            <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
              {rappel.operator} · {rappel.label}
            </Text>
          </Card>
        ) : null}

        <View style={styles.pousse} />
        {/* Pas d'annulation : une demande poussée sur le téléphone ne se
            rappelle pas depuis l'application, et un versement déjà parti ne se
            reprend pas non plus. Fermer l'écran n'interrompt rien — et l'écran
            le dit, plutôt que de laisser croire le contraire. */}
        <Text style={[styles.mention, styles.aumilieu, { color: couleurs.textMention }]}>
          {poussee ? t.rechargeAttenteExpire : t.versementDeclareQuand}
        </Text>
        <Button full variant="text" onPress={() => routeur.replace("/(app)/moi")}>
          {t.rechargeAttenteFermer}
        </Button>
      </>,
    );
  }

  if (etape === "abouti" && paiement) {
    return issue(
      <>
        <Illustration name="paiement-abouti" width={144} />
        <Text style={[styles.grandTitre, { color: couleurs.textBody }]}>
          {t.rechargeAboutiTitre}
        </Text>
        {/* LE SOLDE VIENT D'ÊTRE RELU, il ne s'additionne pas. La maquette pose
            `solde + choix` ; un bonus de palier, un remboursement concurrent ou
            une génération lancée ailleurs feraient diverger l'addition du vrai
            solde, et c'est le chiffre auquel on se fie ensuite. */}
        <Text style={[styles.chapeau, { color: couleurs.textSecondary }]}>
          {t.rechargeAboutiTexte(solde)}
        </Text>
        <View style={styles.pousse} />
        <Button full onPress={() => routeur.replace("/(app)/moi")}>{t.continuer}</Button>
      </>,
    );
  }

  if (etape === "echec" && paiement) {
    return issue(
      <>
        <Illustration name="paiement-echoue" width={144} />
        <Text style={[styles.grandTitre, { color: couleurs.textBody }]}>
          {t.rechargeEchecTitre}
        </Text>
        {/* CE QUE L'UTILISATEUR VEUT SAVOIR D'ABORD : son argent.
            « Rien n'a été prélevé » n'est vrai que d'une demande poussée qui a
            échoué. Sur un versement déclaré, l'argent est parti AVANT la
            déclaration : le refus dit que l'administration ne l'a pas retrouvé,
            pas qu'on a gardé son argent. Le lui dire lui apprendrait à ne pas
            réclamer. On sert alors le motif, que le contrat rend pour ça. */}
        {rienNAEtePreleve(paiement) ? (
          <Text style={[styles.chapeau, { color: couleurs.textSecondary }]}>
            {t.rechargeEchecTexte}
          </Text>
        ) : null}
        {paiement.failureReason ? (
          <Text style={[styles.chapeau, { color: couleurs.textSecondary }]}>
            {paiement.failureReason}
          </Text>
        ) : null}
        <View style={styles.pousse} />
        <View style={styles.actions}>
          <Button full icon="refresh-cw" onPress={recommence}>{t.maintReessayer}</Button>
          <Button full variant="text" onPress={() => routeur.replace("/(app)/moi")}>
            {t.retour}
          </Button>
        </View>
      </>,
    );
  }

  const recents = mouvementsRecents(mouvements);
  const recap = apercu ? recapDuPaiement(apercu) : null;
  /* Un versement ne se déclare que si TOUT est là : un compte servi, un canal
     choisi ou déduit, un palier, et les deux champs. Il manque l'un d'eux, le
     bouton reste éteint — mieux qu'un envoi refusé après coup. */
  const declarable = Boolean(compte && canal && palier)
    && declarationComplete(depuis, reference);
  /* L'achat n'a de surface que si un compte est servi : sans lui il n'y a nulle
     part où verser, et ce n'est pas une panne, c'est un état. */
  const achetable = manuel && compte !== null;

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

        {etape === "recap" && recap ? (
          <>
            <Text style={[styles.titre, { color: couleurs.textBody }]}>
              {t.rechargeRecapTitre}
            </Text>

            <Card surface="panel" padding={16} radius="lg" style={styles.bloc}>
              <View style={styles.ligneRecap}>
                <Text style={[styles.texteRecap, { color: couleurs.textSecondary }]}>
                  {t.rechargeRecapCredits}
                </Text>
                <Text style={[styles.valeur, { color: couleurs.textBody }]}>
                  {t.rechargeUnite(recap.credits)}
                </Text>
              </View>
              {recap.bonus !== null ? (
                <Text style={[styles.bonus, { color: couleurs.feedbackSuccess }]}>
                  {t.rechargeEconomie(recap.bonus)}
                </Text>
              ) : null}

              <View style={styles.ligneRecap}>
                <Text style={[styles.texteRecap, { color: couleurs.textSecondary }]}>
                  {t.rechargeRecapMontant}
                </Text>
                <Text style={[styles.valeur, { color: couleurs.textBody }]}>
                  {montantEnClair(recap.montant, recap.devise)}
                </Text>
              </View>
              {/* LES FRAIS NE SE MONTRENT QUE S'IL Y EN A. « frais 0 » n'apprend
                  rien et fait recompter. */}
              {recap.frais !== null ? (
                <Text style={[styles.frais, { color: couleurs.textMention }]}>
                  {t.rechargeRecapFrais(montantEnClair(recap.frais, recap.devise))}
                </Text>
              ) : null}

              <View
                style={[styles.ligneTotal, {
                  borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
                }]}
              >
                <Text style={[styles.texteRecap, { color: couleurs.textBody }]}>
                  {t.rechargeRecapTotal}
                </Text>
                {/* SERVI, JAMAIS ADDITIONNÉ : sur la carte, c'est le
                    bénéficiaire qui supporte les frais, et « montant + frais »
                    afficherait plus que ce qu'on demande de taper. */}
                <Text style={[styles.total, { color: couleurs.textBody }]}>
                  {montantEnClair(recap.total, recap.devise)}
                </Text>
              </View>
            </Card>

            <Button full variant="text" onPress={() => setApercu(null)}>
              {t.rechargeRecapModifier}
            </Button>

            <View style={styles.bloc}>
              <SectionLabel>{t.versementTitre}</SectionLabel>
              <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
                {t.versementTexte}
              </Text>

              {/* LE COMPTE, ses trois champs ensemble. Le nom compte autant que
                  le numéro : c'est lui que l'opérateur affiche au moment de
                  valider. Sélectionnable, faute de presse-papiers porté —
                  l'appui long copie, et un bouton « Copier » qui ne copierait
                  rien serait pire. */}
              {compte ? (
                <Card surface="panel" padding={15} radius="lg" style={styles.rappel}>
                  <Text style={[styles.mention, { color: couleurs.textSecondary }]}>
                    {t.versementCompte}
                  </Text>
                  <Text selectable style={[styles.numero, { color: couleurs.textBody }]}>
                    {compte.number}
                  </Text>
                  <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
                    {compte.operator} · {compte.label}
                  </Text>
                </Card>
              ) : null}

              <View style={{ gap: nativeSpace[12], marginTop: nativeSpace[14] }}>
                <TextField
                  label={t.versementNumeroEmploye}
                  value={depuis}
                  onChangeText={setDepuis}
                />
                <TextField
                  label={t.versementReference}
                  value={reference}
                  placeholder={t.versementReferenceExemple}
                  hint={t.versementReferenceAide}
                  onChangeText={setReference}
                />
              </View>

              <View style={{ marginTop: nativeSpace[12] }}>
                <Button
                  full
                  icon="check"
                  disabled={envoi || !declarable}
                  onPress={() => void declare()}
                >
                  {t.versementDeclarer}
                </Button>
              </View>
              <Text style={[styles.mention, styles.aumilieu, { color: couleurs.textMention }]}>
                {t.versementDelai}
              </Text>
            </View>
          </>
        ) : achetable ? (
          <>
            <Text style={[styles.titre, { color: couleurs.textBody }]}>{t.rechargeTitre}</Text>
            <Text style={[styles.intro, { color: couleurs.textSecondary }]}>
              {t.rechargeIntro}
            </Text>

            <View style={styles.options}>
              {paliersOrdonnes(paliers).map((p) => {
                const actif = p.id === palier;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: actif }}
                    onPress={() => setPalier(p.id)}
                    style={[styles.option, {
                      borderColor: actif ? couleurs.action : couleurs.borderObject,
                      backgroundColor: actif ? couleurs.actionQuietBg : "transparent",
                    }]}
                  >
                    <Text
                      style={[styles.combien, {
                        color: actif ? couleurs.textAccent : couleurs.textBody,
                      }]}
                    >
                      {t.rechargeUnite(p.credits)}
                    </Text>
                    {/* La remise vient du serveur, avec son signe : ce sont des
                        crédits EN PLUS, pas une réduction sur le prix. Nulle,
                        la ligne n'existe pas plutôt que d'afficher « +0 % ». */}
                    {p.discountPercent !== null && p.discountPercent > 0 ? (
                      <Text style={[styles.bonus, { color: couleurs.feedbackSuccess }]}>
                        {t.rechargeEconomie(p.discountPercent)}
                      </Text>
                    ) : null}
                    <Text style={[styles.prix, { color: couleurs.textBody }]}>
                      {montantEnClair(p.amount, p.currency)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* COMMENT PAYER — et ce sont les CANAUX servis, pas deux natures
                écrites d'avance. Deux canaux d'un même opérateur ne portent pas
                le même barème, `label` les distingue, et en fondre un dans
                l'autre ferait choisir à la place de quelqu'un ce qu'il paiera en
                plus. Un seul canal : la section ne paraît pas, elle ne poserait
                qu'une question sans réponse alternative. */}
            {moyens.length > 1 ? (
              <View style={styles.bloc}>
                <SectionLabel>{t.rechargeMoyen}</SectionLabel>
                <View style={styles.options}>
                  {moyens.map((c) => {
                    const actif = c.id === moyen;
                    return (
                      <Pressable
                        key={c.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: actif }}
                        onPress={() => setMoyen(c.id)}
                        style={[styles.moyen, {
                          borderColor: actif ? couleurs.action : couleurs.borderObject,
                          backgroundColor: actif ? couleurs.actionQuietBg : "transparent",
                        }]}
                      >
                        <Icon
                          name={iconeDuMoyen(c)}
                          size={17}
                          color={actif ? couleurs.textAccent : couleurs.textMention}
                        />
                        <View style={styles.corps}>
                          <Text
                            style={[styles.quoi, {
                              color: actif ? couleurs.textAccent : couleurs.textBody,
                            }]}
                          >
                            {c.label}
                          </Text>
                          <Text style={[styles.mention, { color: couleurs.textMention }]}>
                            {c.kind === "mobile_money" ? t.rechargeMobile : t.rechargeCarte}
                          </Text>
                        </View>
                        {actif ? (
                          <Icon name="check" size={16} color={couleurs.textAccent} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.pied}>
              <CreditIndicator label={t.creditReste(solde)} />
              <View style={{ marginTop: nativeSpace[10] }}>
                {/* LE BOUTON ANNONCE LE PRIX DU PALIER, pas le total : celui-ci
                    dépend des frais, et les frais viennent du serveur. C'est
                    précisément ce que le récapitulatif existe pour apprendre —
                    et c'est pour ça qu'il vient AVANT de payer. */}
                <Button
                  full
                  disabled={envoi || !apercuDemandable(palier, moyen)}
                  onPress={() => void demandeApercu()}
                >
                  {t.rechargePayer(
                    choisi ? montantEnClair(choisi.amount, choisi.currency) : "",
                  )}
                </Button>
              </View>
            </View>
          </>
        ) : (
          /* Ni palier ni compte à proposer : le solde reste, il est du socle.
             Un écran de recharge qui n'affiche plus rien du tout ferait croire
             à une panne là où il n'y a qu'une voie fermée. */
          <Card surface="panel" padding={16} radius="lg">
            {/* UNE SEULE FOIS — `CreditIndicator` porte déjà son libellé, et le
                rend à côté du nombre. Même doublon que sur « Moi ». */}
            <CreditIndicator label={t.moiSolde} balance={solde} variant="solde" />
          </Card>
        )}

        {/* LE SECOND CHEMIN VERS DES CRÉDITS — « Sans payer » — attend son
            écran. Le parrainage compte d'autant plus quand l'achat par
            opérateur est fermé, mais §3.29 n'est pas portée : une ligne qui
            n'ouvre rien vaut moins qu'une ligne absente. Elle arrive avec lui,
            et le bonus se lira alors dans `/public/config` — jamais écrit ici,
            il se règle en back-office. */}

        <View style={styles.bloc}>
          <SectionLabel>{t.mouvementsTitre}</SectionLabel>
          {recents.length ? (
            <>
              {recents.map((m, i) => (
                <View
                  key={m.id}
                  style={[styles.rang, i > 0 ? {
                    borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
                  } : null]}
                >
                  <View style={styles.corps}>
                    <Text style={[styles.quoi, { color: couleurs.textBody }]} numberOfLines={1}>
                      {CREDIT_REASON_LABELS[m.reason][langue === "en" ? "en" : "fr"]}
                    </Text>
                    <Text style={[styles.mention, { color: couleurs.textMention }]}>
                      {dateCourte(m.createdAt.slice(0, 10), langue)}
                    </Text>
                  </View>
                  <Text
                    style={[styles.montant, {
                      color: m.amount > 0 ? couleurs.feedbackSuccess : couleurs.textSecondary,
                    }]}
                  >
                    {montreLeMouvement(m.amount)}
                  </Text>
                </View>
              ))}
              {offreTout(mouvements) ? (
                <Button
                  full
                  variant="text"
                  onPress={() => routeur.push("/(app)/mouvements")}
                >
                  {t.mouvementsTout}
                </Button>
              ) : null}
            </>
          ) : (
            <Text style={[styles.texte, { color: couleurs.textMention }]}>
              {t.mouvementsAucun}
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
  issue: {
    flex: 1, paddingHorizontal: nativeSpace[20],
    alignItems: "center",
  },
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  bloc: { marginTop: nativeSpace[24] },
  // Ce qui occupe la place restante et pousse le pied vers le bas.
  pousse: { flex: 1, minHeight: nativeSpace[24] },
  pied: { marginTop: nativeSpace[24] },
  actions: { width: "100%", gap: nativeSpace[8] },
  titre: {
    fontFamily: nativeFont.displayMedium, fontSize: 22,
    letterSpacing: nativeLetterSpacing(22, nativeTracking.title),
    marginTop: nativeSpace[4],
  },
  grandTitre: {
    fontFamily: nativeFont.displayMedium, fontSize: 22, textAlign: "center",
    letterSpacing: nativeLetterSpacing(22, nativeTracking.title),
    marginTop: nativeSpace[20], marginBottom: nativeSpace[8],
  },
  chapeau: {
    fontFamily: nativeFont.bodyRegular, fontSize: 14.5, textAlign: "center",
    marginTop: nativeSpace[2],
  },
  intro: { fontFamily: nativeFont.bodyRegular, fontSize: 13.5, marginTop: nativeSpace[4] },
  badge: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[6],
    paddingHorizontal: nativeSpace[10], paddingVertical: nativeSpace[4],
    borderRadius: nativeRadius.pill, marginTop: nativeSpace[16],
  },
  badgeTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 12 },
  options: { gap: nativeSpace[8], marginTop: nativeSpace[10] },
  option: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    paddingHorizontal: nativeSpace[14], paddingVertical: nativeSpace[14],
    minHeight: nativeTouchMin,
    borderRadius: nativeRadius.lg, borderWidth: nativeBorder.width,
  },
  moyen: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    paddingHorizontal: nativeSpace[14], paddingVertical: nativeSpace[12],
    minHeight: nativeTouchMin,
    borderRadius: nativeRadius.lg, borderWidth: nativeBorder.width,
  },
  combien: { fontFamily: nativeFont.displayMedium, fontSize: 19 },
  prix: { fontFamily: nativeFont.displayMedium, fontSize: 17, marginLeft: "auto" },
  bonus: { fontFamily: nativeFont.bodySemibold, fontSize: 11.5 },
  ligneRecap: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
    gap: nativeSpace[12], marginTop: nativeSpace[6],
  },
  ligneTotal: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
    gap: nativeSpace[12], marginTop: nativeSpace[12], paddingTop: nativeSpace[12],
  },
  texteRecap: { fontFamily: nativeFont.bodyRegular, fontSize: 14 },
  valeur: { fontFamily: nativeFont.displayMedium, fontSize: 16 },
  total: { fontFamily: nativeFont.displayMedium, fontSize: 21 },
  frais: { fontFamily: nativeFont.bodyRegular, fontSize: 12, marginTop: nativeSpace[2] },
  rappel: { marginTop: nativeSpace[14], width: "100%" },
  texte: { fontFamily: nativeFont.bodyRegular, fontSize: 14, marginTop: nativeSpace[6] },
  mention: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[6] },
  aumilieu: { textAlign: "center" },
  numero: { fontFamily: nativeFont.displayMedium, fontSize: 21, marginTop: nativeSpace[2] },
  rang: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
  },
  corps: { flex: 1, minWidth: 0 },
  quoi: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  montant: { fontFamily: nativeFont.displayMedium, fontSize: 16 },
});

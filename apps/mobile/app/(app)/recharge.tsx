import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  collectionAccountsSchema, creditBalanceSchema, creditBundlesSchema,
  paymentChannelsSchema, paymentsSchema,
  type CollectionAccount, type CreditBundle, type CreditTransaction,
  type PaymentChannel,
} from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeRadius, nativeSpace, nativeTouchMin,
} from "@lehno/tokens";
import {
  Banner, Button, Card, CreditIndicator, Icon, LoadingState, SectionLabel,
  TextField, Toast, useCouleurs,
} from "@lehno/ui-native";
import { Choix } from "../../composants/Choix.js";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { dateCourte } from "../../lib/carnet.js";
import {
  canalPourLeCompte, comptePourVerser, corpsDeDeclaration, declarationComplete,
  montreLeMouvement, mouvementsRecents, offreTout, parcoursDeRecharge,
} from "../../lib/versement.js";
import { CREDIT_REASON_LABELS } from "@lehno/contracts";

/* Crédits et recharge — §3.9.
 *
 * AU LANCEMENT, L'ORDRE DES GESTES S'INVERSE. `topup.provider` est éteint :
 * aucun opérateur n'encaisse, donc rien ne se pousse sur le téléphone. On verse
 * depuis son application d'opérateur, PUIS on revient déclarer. Ce n'est pas
 * l'écran d'achat amputé — c'est un autre écran : le solde, le versement, les
 * mouvements.
 *
 * LE COMPTE SUR LEQUEL VERSER EST SERVI, jamais écrit ici. La copie du handoff
 * le donnait en dur ; c'est le numéro sur lequel part de l'argent, et le
 * contrat ne rend que les comptes visibles et actifs précisément pour qu'un
 * écran resté ouvert n'envoie pas sur un compte retiré.
 *
 * ON MONTRE LES TROIS CHAMPS, pas seulement le numéro. Au moment de valider,
 * l'opérateur affiche le NOM du destinataire : quelqu'un à qui l'on n'a annoncé
 * que « le compte Lehno » voit s'afficher « ANA KAY » et peut renoncer, croyant
 * s'être trompé. L'opérateur, le numéro et le nom se lisent donc ensemble.
 */
export default function Recharge() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();

  const [solde, setSolde] = useState<number | null>(null);
  const [mouvements, setMouvements] = useState<CreditTransaction[]>([]);
  const [paliers, setPaliers] = useState<CreditBundle[]>([]);
  const [comptes, setComptes] = useState<CollectionAccount[]>([]);
  const [canaux, setCanaux] = useState<PaymentChannel[]>([]);
  /* Une déclaration déjà déposée et non encore constatée : l'écran montre alors
     l'attente au lieu du formulaire. Sans ça, on redéclarerait le même
     versement, et deux demandes viseraient un seul virement. */
  const [enAttente, setEnAttente] = useState(false);

  const [palier, setPalier] = useState<string | null>(null);
  const [depuis, setDepuis] = useState("");
  const [reference, setReference] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const parcours = parcoursDeRecharge(actives);
  const manuel = parcours === "manuel";

  const charge = useCallback(async () => {
    try {
      const credits = creditBalanceSchema.parse(await appel<unknown>("/me/credits"));
      setSolde(credits.balance);
      setMouvements(credits.transactions);

      /* Les paliers sont servis sans garde ; le reste suit `topup.manual`.
         Demander ce que le drapeau ferme rendrait un 404 qu'on afficherait
         comme une panne. */
      setPaliers(creditBundlesSchema.parse(
        await appel<unknown>("/me/credit-bundles"),
      ).bundles);

      if (manuel) {
        const [brutComptes, brutCanaux, brutPaiements] = await Promise.all([
          appel<unknown>("/me/collection-accounts"),
          appel<unknown>("/me/payment-channels"),
          appel<unknown>("/me/payments"),
        ]);
        setComptes(collectionAccountsSchema.parse(brutComptes).accounts);
        setCanaux(paymentChannelsSchema.parse(brutCanaux).channels);
        setEnAttente(
          paymentsSchema.parse(brutPaiements).payments.some((p) => p.status === "pending"),
        );
      }
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [langue, manuel]);

  useEffect(() => { void charge(); }, [charge]);

  const compte = comptePourVerser(comptes);
  const canal = compte ? canalPourLeCompte(canaux, compte) : null;

  const declare = async (): Promise<void> => {
    if (!compte || !canal || !palier) return;
    setEnvoi(true);
    setEchec(null);
    try {
      await appel<unknown>("/me/payments", {
        method: "POST",
        gouvernee: true,
        body: JSON.stringify(corpsDeDeclaration({
          palier, canal: canal.id, compte: compte.id, depuis, reference,
        })),
      });
      setEnAttente(true);
      setAccuse(t.versementDeclare);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

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

  const recents = mouvementsRecents(mouvements);
  /* Un versement ne se déclare que si TOUT est là : un compte servi, un canal
     qu'on sait rattacher, et un palier choisi. Il manque l'un des trois, le
     formulaire ne s'ouvre pas — mieux qu'un envoi refusé après coup. */
  const declarable = Boolean(compte && canal && palier)
    && declarationComplete(depuis, reference);

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

        <Card surface="panel" padding={16} radius="lg">
          <Text style={[styles.mention, { color: couleurs.textSecondary }]}>{t.moiSolde}</Text>
          <CreditIndicator label={t.moiSolde} balance={solde} variant="solde" />
        </Card>

        {manuel ? (
          <View style={styles.bloc}>
            <SectionLabel>{t.versementTitre}</SectionLabel>

            {enAttente ? (
              /* L'attente d'un HUMAIN, pas d'une demande poussée : elle peut
                 durer, et l'écran le dit plutôt que de faire tourner un rond. */
              <View style={[styles.attente, { backgroundColor: couleurs.actionQuietBg }]}>
                <View style={styles.ligne}>
                  <Icon name="check" size={16} color={couleurs.textAccent} />
                  <Text style={[styles.declare, { color: couleurs.textAccent }]}>
                    {t.versementDeclare}
                  </Text>
                </View>
                <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
                  {t.versementDeclareTexte}
                </Text>
                <Text style={[styles.mention, { color: couleurs.textMention }]}>
                  {t.versementDeclareQuand}
                </Text>
              </View>
            ) : compte ? (
              <>
                <Text style={[styles.texte, { color: couleurs.textSecondary }]}>
                  {t.versementTexte}
                </Text>

                <View style={{ marginTop: nativeSpace[14] }}>
                  <SectionLabel>{t.versementPalier}</SectionLabel>
                  <Choix
                    options={paliers.map((p) => p.id)}
                    libelle={(id) => {
                      const p = paliers.find((x) => x.id === id);
                      return p ? `${t.rechargeUnite(p.credits)} · ${p.amount} ${p.currency}` : "—";
                    }}
                    valeur={palier}
                    pose={setPalier}
                  />
                </View>

                {/* LE COMPTE, ses trois champs ensemble. Le nom compte autant
                    que le numéro : c'est lui que l'opérateur affiche au moment
                    de valider. Sélectionnable, faute de presse-papiers porté —
                    l'appui long copie, et un bouton « Copier » qui ne copierait
                    rien serait pire. */}
                <Card surface="panel" padding={15} radius="lg" style={styles.compte}>
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
              </>
            ) : (
              /* Aucun compte servi : il n'y a pas de formulaire à montrer, et
                 pas d'erreur à annoncer non plus — c'est un état, pas une
                 panne. On se tait sur le versement. */
              null
            )}
          </View>
        ) : null}

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
  retour: {
    width: nativeTouchMin, height: nativeTouchMin, marginLeft: -nativeSpace[12],
    alignItems: "center", justifyContent: "center",
  },
  bloc: { marginTop: nativeSpace[24] },
  compte: { marginTop: nativeSpace[14] },
  attente: {
    marginTop: nativeSpace[12], padding: nativeSpace[16],
    borderRadius: nativeRadius.lg,
  },
  ligne: { flexDirection: "row", alignItems: "center", gap: nativeSpace[8] },
  declare: { fontFamily: nativeFont.bodySemibold, fontSize: 15 },
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

import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  paymentChannelsSchema, paymentMethodListSchema, paymentMethodSchema,
  type PaymentChannel, type PaymentMethod,
} from "@lehno/contracts";
import { nativeBorder, nativeFont, nativeRadius, nativeSpace, nativeTouchMin } from "@lehno/tokens";
import {
  Banner, Button, ConfirmSheet, EmptyState, Icon, LoadingState, SectionLabel,
  TextField, Toast, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { ecranEteint } from "../../lib/navigation.js";
import { Choix } from "../../composants/Choix.js";
import { EcranFerme } from "../../composants/EcranFerme.js";
import {
  canauxProposables, consequenceDuRetrait, corpsDEnregistrement,
  enregistrementComplet, estExpiree, methodeParDefaut, methodeRemplacee,
} from "../../lib/paiement.js";

/* Méthodes de paiement — §3.25.
 *
 * On vient ici pour deux raisons opposées : parce qu'on veut payer plus vite,
 * et parce qu'on veut qu'un numéro cesse de traîner. La seconde est la plus
 * délicate, parce qu'elle a une conséquence qu'on ne voit pas — le
 * remboursement promis aux CGU §6 tient à l'ANCIENNETÉ d'une méthode, et un
 * retrait la remet à zéro. C'est pour le dire avant le geste que cet écran
 * existe autant que pour la liste.
 */
export default function Paiement() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();

  const [methodes, setMethodes] = useState<PaymentMethod[]>([]);
  const [canaux, setCanaux] = useState<PaymentChannel[]>([]);
  const [lu, setLu] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [accuse, setAccuse] = useState<string | null>(null);

  const [ajoute, setAjoute] = useState(false);
  const [numero, setNumero] = useState("");
  const [canalChoisi, setCanalChoisi] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [aRetirer, setARetirer] = useState<string | null>(null);

  const eteint = ecranEteint("paiement", actives);

  const charge = useCallback(async () => {
    try {
      /* Les canaux servent à PROPOSER les opérateurs, pas à débiter : leur
         absence n'empêche pas de lire ni de retirer, elle empêche seulement
         d'ajouter. Un seul `Promise.all` qui tomberait entier ferait perdre la
         liste pour une raison qui ne la concerne pas. */
      const brut = await appel<unknown>("/me/payment-methods");
      setMethodes(paymentMethodListSchema.parse(brut).paymentMethods);
      setEchec(null);
      try {
        const bruts = await appel<unknown>("/me/payment-channels");
        setCanaux(paymentChannelsSchema.parse(bruts).channels);
      } catch { setCanaux([]); }
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setLu(true);
    }
  }, [langue]);

  useEffect(() => { if (!eteint) void charge(); }, [charge, eteint]);

  const proposables = canauxProposables(canaux);
  const canal = proposables.find((c) => c.id === canalChoisi) ?? null;
  /* CE QUE LE GESTE VA FAIRE, avant qu'on l'appuie. « Un seul numéro par
     opérateur » : chez un opérateur déjà enregistré, « Ajouter » efface. Le
     bouton change donc de mot, et la phrase dit lequel part. */
  const remplacee = canal === null ? null : methodeRemplacee(methodes, canal);
  const defaut = methodeParDefaut(methodes);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const partante = aRetirer === null ? null : methodes.find((m) => m.id === aRetirer) ?? null;
  const consequence = aRetirer === null ? "rien" : consequenceDuRetrait(methodes, aRetirer);

  const enregistre = async (id: string, remplace: PaymentMethod | null): Promise<void> => {
    setEnvoi(true);
    setEchec(null);
    try {
      const nouvelle = await appel<unknown>("/me/payment-methods", {
        method: "POST", body: JSON.stringify(corpsDEnregistrement(numero, id)),
      });
      /* L'ANCIENNE PART DE LA LISTE, parce qu'elle est partie de la base : le
         serveur la supprime, il ne la désactive pas. La garder à l'écran
         montrerait deux numéros chez le même opérateur, ce que le serveur vient
         justement de rendre impossible. */
      setMethodes((d) => [
        paymentMethodSchema.parse(nouvelle),
        ...(remplace === null ? d : d.filter((m) => m.id !== remplace.id)),
      ]);
      setAjoute(false);
      setNumero("");
      setCanalChoisi(null);
      setAccuse(remplace ? t.paiementRemplaceFait : t.paiementAjoutFait);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
    }
  };

  const retire = async (id: string): Promise<void> => {
    setARetirer(null);
    setEchec(null);
    try {
      await appel<unknown>("/me/payment-methods/" + id, { method: "DELETE" });
      setMethodes((d) => d.filter((m) => m.id !== id));
      setAccuse(t.paiementRetire);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  };

  /* L'écran suit `topup.provider` : sans paiement automatique, il n'y a rien à
     enregistrer. Il reste atteignable par un lien profond — les réglages ne
     l'offrent plus, mais une route reste une route —, donc il se garde
     lui-même plutôt que de compter sur celui qui l'ouvre. */
  if (eteint) return <EcranFerme />;

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

        <View style={styles.bloc}>
          <SectionLabel>{t.paiementTitre}</SectionLabel>

          {!lu ? <LoadingState variant="liste" rows={3} title={t.chargement} /> : methodes.length === 0 ? (
            <EmptyState
              illustration="credits-epuises"
              title={t.paiementAucuneTitre}
              text={t.paiementAucuneTexte}
            />
          ) : methodes.map((m) => (
            <View key={m.id} style={[styles.ligne, { borderColor: couleurs.borderObject }]}>
              <View style={styles.identite}>
                {/* LE NUMÉRO NE PARAÎT JAMAIS EN ENTIER — le contrat ne le sert
                    pas, et c'est délibéré : `paymentMethodSchema` est `strict`,
                    un serveur qui le laisserait fuir ferait échouer le parsage
                    plutôt que de l'envoyer jusqu'à un journal de bord. */}
                {/* L'OPÉRATEUR VIENT DE `operator`, pas de `brand` : celui-ci
                    est nul sur un mobile money depuis que le canal le porte, et
                    l'écran ne montrerait plus que quatre chiffres sans dire de
                    qui — ce qu'on relit précisément pour reconnaître son propre
                    numéro. `brand` reste le repli des cartes. */}
                <Text style={[styles.marque, { color: couleurs.textBody }]}>
                  {m.operator ?? m.brand ?? ""}
                  {m.last4 === null ? "" : " •••• " + m.last4}
                </Text>
                <View style={styles.repères}>
                  {m.id === defaut ? (
                    <Text style={[styles.repère, { color: couleurs.textSecondary }]}>
                      {t.paiementDefaut}
                    </Text>
                  ) : null}
                  {/* Ce que la méthode PERMET, pas son ancienneté : le verdict
                      vient du serveur, « le délai est réglable en back-office,
                      et deux versions du parc appliqueraient deux règles ». */}
                  {m.refundEligible ? (
                    <Text style={[styles.repère, { color: couleurs.textSecondary }]}>
                      {t.paiementRemboursable}
                    </Text>
                  ) : null}
                  {estExpiree(m, aujourdhui) ? (
                    <Text style={[styles.repère, { color: couleurs.feedbackError }]}>
                      {t.paiementExpire}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.paiementRetirer}
                onPress={() => setARetirer(m.id)}
                style={styles.retirer}
              >
                <Icon name="trash-2" size={18} color={couleurs.textSecondary} />
              </Pressable>
            </View>
          ))}
        </View>

        {/* ON N'AJOUTE QUE CE QU'ON SAIT AJOUTER, et rien ne le dit mieux que
            l'absence du bouton. Sans opérateur servi, la plateforme n'a aucun
            canal mobile money : ouvrir le formulaire ferait choisir dans une
            liste vide, puis échouer à l'envoi. Même règle qu'au versement
            manuel sans compte de collecte — l'écran se tait plutôt que de
            montrer un formulaire vers nulle part.

            Les CARTES ne s'ajoutent pas ici : elles s'enregistrent par la
            référence opaque que le prestataire rend, dans SA page, et aucune
            n'est intégrée. Voir `SORTE_AJOUTABLE`. */}
        {lu && proposables.length > 0 ? (
          ajoute ? (
            <View style={styles.bloc}>
              <SectionLabel>{t.paiementAjoutTitre}</SectionLabel>
              <View style={styles.champ}>
                {/* LE CANAL, pas un nom tapé : « l'opérateur vient du canal,
                    il ne se saisit pas ». Deux canaux d'un même opérateur
                    restent deux — ils ne portent pas le même barème, et les
                    fondre choisirait à la place de quelqu'un ce qu'il paiera
                    en plus. */}
                <Choix
                  options={proposables.map((c) => c.id)}
                  libelle={(id) => proposables.find((c) => c.id === id)?.label ?? id}
                  valeur={canalChoisi}
                  pose={setCanalChoisi}
                />
              </View>
              <View style={styles.champ}>
                <TextField
                  label={t.paiementNumero}
                  value={numero}
                  nature="code"
                  onChangeText={setNumero}
                />
              </View>
              {/* LE REMPLACEMENT SE DIT AVANT, jamais après. Le serveur
                  supprime l'ancienne ligne et le délai de remboursement repart
                  de zéro — « hériter de l'ancienneté d'un numéro qu'on vient de
                  changer viderait la garde anti-fraude de son sens ». Découvrir
                  la perte sur la liste serait la découvrir trop tard. */}
              {remplacee !== null ? (
                <View style={styles.champ}>
                  <Banner intent="warning">
                    {t.paiementRemplaceTitre + " — " + t.paiementRemplace(remplacee.last4 ?? "")}
                  </Banner>
                </View>
              ) : null}

              <View style={styles.champ}>
                <Button
                  variant="primary"
                  disabled={envoi || !enregistrementComplet(numero, canalChoisi)}
                  onPress={() => {
                    if (canalChoisi !== null) void enregistre(canalChoisi, remplacee);
                  }}
                >
                  {remplacee === null ? t.paiementAjouter : t.paiementRemplacer}
                </Button>
              </View>
            </View>
          ) : (
            <View style={styles.bloc}>
              <Button variant="outline" onPress={() => setAjoute(true)}>
                {t.paiementAjouter}
              </Button>
            </View>
          )
        ) : null}
      </ScrollView>

      {/* CE QUE LE RETRAIT COÛTE, DIT AVANT LE GESTE. La ligne est supprimée,
          pas désactivée : réenregistrer le même numéro repart d'une ancienneté
          nulle. Le délai n'est PAS chiffré — aucune route ne le sert, et
          l'écrire en dur le figerait dans une version livrée pendant qu'il
          reste réglable en back-office. */}
      {partante ? (
        <ConfirmSheet
          titre={t.paiementRetraitTitre}
          texte={[
            t.paiementRetraitTexte,
            ...(consequence === "la-derniere" ? [t.paiementRetraitDerniere] : []),
            ...(consequence === "rien" ? [] : [t.paiementRetraitDelai]),
          ].join("\n\n")}
          confirmer={t.paiementRetirer}
          annuler={t.annuler}
          destructif
          insetBas={insets.bottom}
          onConfirmer={() => { void retire(partante.id); }}
          onAnnuler={() => setARetirer(null)}
        />
      ) : null}

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
  champ: { marginTop: nativeSpace[12] },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    marginTop: nativeSpace[12], padding: nativeSpace[12],
    borderWidth: nativeBorder.width, borderRadius: nativeRadius.lg,
  },
  identite: { flex: 1 },
  marque: { fontFamily: nativeFont.bodyMedium, fontSize: 14 },
  repères: { flexDirection: "row", flexWrap: "wrap", gap: nativeSpace[8], marginTop: nativeSpace[4] },
  repère: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5 },
  retirer: {
    width: nativeTouchMin, height: nativeTouchMin,
    alignItems: "center", justifyContent: "center",
  },
});

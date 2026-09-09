import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ownerWishListSchema, wishSchema } from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeRadius, nativeSpace, nativeTouchMin,
} from "@lehno/tokens";
import {
  Banner, Button, Card, ConfirmSheet, EmptyState, Icon, LoadingState, Provenance,
  SectionLabel, TextField, Toast, useCouleurs,
} from "@lehno/ui-native";
import { Bascule } from "../../composants/Bascule.js";
import { EcranFerme } from "../../composants/EcranFerme.js";
import { useLangue } from "../../lib/langue.js";
import { appel, ErreurDApi } from "../../lib/api.js";
import { messageDErreur } from "../../lib/session.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { ecranEteint } from "../../lib/navigation.js";
import {
  cheminDEcriture, cheminDeLecture, cibleDuSouhait, corpsDePosition, corpsDeRetouche,
  corpsDeVisibilite, domaineDuLien, lienOuvrable, origineDeLIdee, ouvreLeMien, ouvreLIdee,
  peutEnregistrer, peutRetoucher, positionsDuSouhait, prixAffichable, reservationDuSouhait,
  retraitEmporteUneReservation, saisieDepuis,
  type CaseDePosition, type Position, type SaisieDuSouhait, type SouhaitOuvert,
} from "../../lib/souhait.js";

/* Le détail d'un souhait — §3.19.
 *
 * CE QUI MANQUAIT : la liste montrait un intitulé et deux boutons. Le prix, le
 * lien, la photo, la provenance, les précisions n'existaient nulle part — donc
 * « où le trouver », qui est ce qui rend un souhait offrable, ne se lisait pas.
 *
 * UN SEUL ÉCRAN POUR DEUX NATURES. Ce que JE demande peut paraître sur ma liste
 * partagée : la visibilité y est un vrai interrupteur, et c'est le geste le plus
 * conséquent de l'écran. Une idée que j'ai notée POUR QUELQU'UN n'a pas de
 * visibilité du tout — elle ne se publie nulle part, l'interrupteur n'a pas à
 * exister sur elle, et son vocabulaire change. Tout cela se décide dans
 * `lib/souhait.ts` ; ici on applique.
 *
 * L'ÉTAT SE LIT ET SE CHANGE. Le montrer en étiquette seule laissait « déjà
 * offert » n'exister que comme bouton : un état du modèle qu'on ne peut pas
 * lire n'en est pas un.
 *
 * « RETIRER » VIT EN BAS, EN CONTOUR : trouvable sans être offert.
 */
export default function Souhait() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();
  const { actives } = useDrapeaux();

  /* UNE ROUTE RESTE UNE ROUTE : la navigation ne propose pas cet écran quand
     son drapeau est éteint, mais un lien profond l'atteint encore. Et les
     paramètres qu'il pose ne sont pas de confiance — `cibleDuSouhait` les
     refuse s'ils ne sont pas des identifiants. */
  const { id, liste, occasion } = useLocalSearchParams<{
    id?: string; liste?: string; occasion?: string;
  }>();
  /* MÉMORISÉE, et ce n'est pas de l'optimisation. `cibleDuSouhait` rend un
     objet neuf à chaque rendu ; sans `useMemo`, `charge` changerait d'identité
     à chaque rendu, l'effet de focus le rappellerait, et chaque réponse
     provoquerait le rendu suivant — une boucle de requêtes qui ne s'arrête
     jamais. La dépendance porte donc sur les paramètres, pas sur l'objet. */
  const cible = useMemo(
    () => cibleDuSouhait({ id, liste, occasion }), [id, liste, occasion],
  );

  /* DEUX DRAPEAUX POUR UN ÉCRAN, et il faut les deux : `wishlist.own` ouvre ma
     liste partagée, `wishlist` ouvre les souhaits notés sur l'occasion d'un
     proche. Garder l'écran avec l'autre clé le laisserait s'ouvrir sur une
     route que le serveur a fermée — 404, affiché comme une panne sur un compte
     parfaitement sain.

     Une cible illisible n'est pas un écran éteint : c'est une adresse qu'on ne
     sait pas lire, et elle se dit « introuvable » plus bas. */
  const eteint = cible === null
    ? false
    : cible.genre === "mien"
      ? ecranEteint("listes", actives)
      : ecranEteint("souhait", actives);

  const [ouvert, setOuvert] = useState<SouhaitOuvert | null>(null);
  const [absent, setAbsent] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [retire, setRetire] = useState(false);
  const [demandeLeRetrait, setDemandeLeRetrait] = useState(false);
  const [edite, setEdite] = useState(false);
  const [saisie, setSaisie] = useState<SaisieDuSouhait | null>(null);

  /* La garde de CHARGEMENT tient dans la fonction, pas seulement dans l'effet :
     elle couvre aussi le rechargement au retour sur l'écran, que l'effet ne
     voit pas. Sans elle, le 404 d'une route fermée reviendrait se poser en
     bandeau par-dessus l'état fermé. */
  const charge = useCallback(async () => {
    if (eteint) return;
    if (cible === null) { setAbsent(true); return; }
    try {
      const brut = await appel<unknown>(cheminDeLecture(cible));
      /* Chaque nature relue par SON schéma. `ownerWishListSchema` existe au
         contrat ; la liste des souhaits d'une occasion y est posée nue — on la
         compose ici plutôt que de relire un tableau à la main. */
      const trouve = cible.genre === "mien"
        ? ouvreLeMien(ownerWishListSchema.parse(brut), cible.souhait)
        : ouvreLIdee(wishSchema.array().parse(brut), cible.souhait);

      setAbsent(trouve === null);
      setOuvert(trouve);
      setEchec(null);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    }
  }, [cible, eteint, langue]);

  useFocusEffect(useCallback(() => { if (!eteint) void charge(); }, [charge, eteint]));

  /* Le formulaire se remplit de ce qui EST, jamais de ce qu'on avait tapé la
     fois d'avant : rouvrir « Modifier » sur une saisie abandonnée renverrait au
     serveur des valeurs que personne ne relit. */
  useEffect(() => {
    if (!edite) setSaisie(null);
    else if (ouvert) setSaisie(saisieDepuis(ouvert.souhait));
  }, [edite, ouvert]);

  /* Elle rend l'ISSUE, pas rien : le formulaire ne se referme que sur un
     succès. Refermer quoi qu'il arrive effacerait une saisie qui n'a jamais
     atteint le serveur, et la panne serait annoncée sur un écran qui a déjà
     oublié ce qu'on lui demandait. */
  const ecrit = async (corps: unknown, motDeFin: string | null): Promise<boolean> => {
    if (cible === null) return false;
    setEnvoi(true);
    setEchec(null);
    try {
      await appel<unknown>(cheminDEcriture(cible), {
        method: "PATCH",
        body: JSON.stringify(corps),
      });
      if (motDeFin) setAccuse(motDeFin);
      await charge();
      return true;
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
      return false;
    } finally {
      setEnvoi(false);
    }
  };

  const retireLeSouhait = async (): Promise<void> => {
    if (cible === null) return;
    setDemandeLeRetrait(false);
    setEnvoi(true);
    setEchec(null);
    try {
      await appel<unknown>(cheminDEcriture(cible), { method: "DELETE" });
      /* On ne recharge PAS : le souhait n'est plus là, et la relecture
         rendrait « introuvable » — la panne, là où il s'agit d'un succès. */
      setRetire(true);
    } catch (e) {
      setEchec(messageDErreur(e instanceof ErreurDApi ? e.enveloppe : null, langue));
    } finally {
      setEnvoi(false);
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

  const page = [styles.page, { paddingTop: insets.top + nativeSpace[8] }];

  if (eteint) return <EcranFerme />;

  if (echec && ouvert === null && !absent) {
    return (
      <View style={page}>
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

  /* RETIRÉ N'EST PAS INTROUVABLE, et les deux se ressemblent à l'écran : dans
     les deux cas le souhait n'est plus là. L'ordre les distingue — on vient de
     le retirer soi-même, et la phrase le confirme au lieu d'annoncer une
     panne. */
  if (retire) {
    return (
      <View style={page}>
        {retour}
        <Banner intent="success">{t.souhaitRetireFait}</Banner>
        <View style={{ marginTop: nativeSpace[16] }}>
          <Button full variant="outline" icon="corner-up-left" onPress={() => routeur.back()}>
            {t.souhaitRetourListe}
          </Button>
        </View>
      </View>
    );
  }

  if (absent) {
    return (
      <View style={page}>
        {retour}
        <EmptyState
          icon="circle-question-mark"
          title={t.introuvableTitre}
          text={t.introuvableTexte}
          actionLabel={t.souhaitRetourListe}
          onAction={() => routeur.back()}
        />
      </View>
    );
  }

  if (ouvert === null) {
    return (
      <View style={page}>
        {retour}
        <LoadingState title={t.chargement} rows={3} />
      </View>
    );
  }

  const { souhait } = ouvert;
  const mien = ouvert.genre === "mien";
  const prix = prixAffichable(souhait, langue);
  const adresse = lienOuvrable(souhait.link);
  const reservation = reservationDuSouhait(ouvert);
  const origine = origineDeLIdee(ouvert);
  const cases = positionsDuSouhait(ouvert);

  const libelleDeLaCase: Record<Position, string> = {
    disponible: t.souhaitDisponible,
    reserve: t.souhaitReserve,
    etudier: t.souhaitAEtudier,
    retenu: t.souhaitRetenu,
    offert: t.souhaitOffertEtat,
  };

  /* Une case qui ne s'écrit pas ne se PRESSE pas non plus : un bouton qui
     n'enregistre rien ferait croire au geste. « Réservé » reste visible et
     muet — c'est un état, pas une commande. */
  const pastille = (c: CaseDePosition) => {
    const dessin = [styles.pastille, {
      borderColor: c.active ? "transparent" : couleurs.borderObject,
      backgroundColor: c.active ? couleurs.action : "transparent",
    }];
    const mot = (
      <Text style={[styles.pastilleTexte, {
        color: c.active ? couleurs.textOnAccent : couleurs.textSecondary,
      }]}>
        {libelleDeLaCase[c.cle]}
      </Text>
    );
    if (!c.reglable) return <View key={c.cle} style={dessin}>{mot}</View>;
    return (
      <Pressable
        key={c.cle}
        accessibilityRole="button"
        accessibilityState={{ selected: c.active }}
        disabled={envoi}
        onPress={() => void ecrit(corpsDePosition(c.cle, ouvert.genre), null)}
        style={dessin}
      >
        {mot}
      </Pressable>
    );
  };

  if (edite && saisie) {
    return (
      <ScrollView
        contentContainerStyle={[styles.page, {
          paddingTop: insets.top + nativeSpace[8],
          paddingBottom: insets.bottom + nativeSpace[24],
        }]}
        keyboardShouldPersistTaps="handled"
      >
        {retour}
        <Text style={[styles.titre, { color: couleurs.textBody }]}>{t.souhaitModifierTitre}</Text>

        {echec ? (
          <View style={{ marginTop: nativeSpace[12] }}>
            <Banner intent="error">{echec}</Banner>
          </View>
        ) : null}

        <View style={{ marginTop: nativeSpace[16] }}>
          <TextField
            label={t.souhaitQuoi}
            placeholder={t.souhaitQuoiExemple}
            value={saisie.intitule}
            onChangeText={(v) => setSaisie({ ...saisie, intitule: v })}
          />
        </View>
        <View style={{ marginTop: nativeSpace[12] }}>
          <TextField
            label={t.souhaitCombien}
            value={saisie.prix}
            onChangeText={(v) => setSaisie({ ...saisie, prix: v })}
          />
        </View>
        <View style={{ marginTop: nativeSpace[12] }}>
          {/* Une adresse ne se capitalise pas : `nature="email"` porte
              exactement ce réglage — pas de majuscule, pas de correction — et
              c'est ce dont une URL a besoin. Sans lui, « Https://… » part au
              serveur, qui la refuse pour une lettre. */}
          <TextField
            label={t.souhaitLien}
            nature="email"
            placeholder="https://"
            value={saisie.lien}
            onChangeText={(v) => setSaisie({ ...saisie, lien: v })}
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

        <View style={{ marginTop: nativeSpace[16] }}>
          {/* Rien à envoyer, rien à faire : le contrat refuse un corps vide,
              et un bouton actif sur un formulaire intact promet un effet qu'il
              n'aura pas. */}
          <Button
            full
            disabled={envoi || !peutEnregistrer(saisie, souhait)}
            onPress={() => {
              void ecrit(corpsDeRetouche(saisie, ouvert), t.souhaitModifieEnregistre)
                .then((abouti) => { if (abouti) setEdite(false); });
            }}
          >
            {t.enregistrer}
          </Button>
        </View>
        <View style={{ marginTop: nativeSpace[8] }}>
          <Button full variant="text" onPress={() => setEdite(false)}>
            {t.feuillePasMaintenant}
          </Button>
        </View>
      </ScrollView>
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
        {retour}

        {echec ? (
          <View style={{ marginBottom: nativeSpace[12] }}>
            <Banner intent="error">{echec}</Banner>
          </View>
        ) : null}

        {/* LA PHOTO NE S'AFFICHE QUE SI ELLE EXISTE. La maquette en fait une
            action — « ajouter une photo » —, et le contrat n'a pas de quoi la
            tenir : ni `createOwnerWishSchema` ni `updateOwnerWishSchema` ne
            portent `imageUrl`, et aucune route ne dépose de fichier. Un bouton
            posé là ne ferait rien ; un cadre gris vide sans bouton ne dirait
            rien non plus. On se tait donc, et l'image paraît le jour où le
            serveur sait en recevoir une. */}
        {souhait.imageUrl ? (
          <Image
            source={{ uri: souhait.imageUrl }}
            style={[styles.photo, { backgroundColor: couleurs.surfacePanel }]}
            accessibilityLabel={souhait.label}
            resizeMode="cover"
          />
        ) : null}

        <Text style={[styles.titre, { color: couleurs.textBody }]}>{souhait.label}</Text>
        {prix ? (
          <Text style={[styles.prix, { color: couleurs.textBody }]}>{prix}</Text>
        ) : null}

        <View style={styles.bloc}>
          <SectionLabel>{mien ? t.souhaitEtat : t.souhaitCandidatEtat}</SectionLabel>
          <View style={styles.pastilles}>{cases.map(pastille)}</View>
        </View>

        {/* Une réservation dit qui, ou dit qu'elle ne le dit pas. Une
            réservation muette laisserait croire à un défaut d'affichage — et
            pire, à un souhait que personne n'a pris. */}
        {reservation ? (
          <View style={[styles.reservation, { backgroundColor: couleurs.surfacePanel }]}>
            <Icon name="bookmark" size={16} color={couleurs.textAccent} />
            <Text style={[styles.reservationTexte, { color: couleurs.textBody }]}>
              {reservation.anonyme
                ? t.souhaitReserveAnonyme
                : t.souhaitReservePar(reservation.qui)}
            </Text>
          </View>
        ) : null}

        {souhait.details ? (
          <View style={styles.bloc}>
            <SectionLabel>{t.souhaitPrecisions}</SectionLabel>
            <Text style={[styles.paragraphe, { color: couleurs.textSecondary }]}>
              {souhait.details}
            </Text>
          </View>
        ) : null}

        {/* « Où le trouver » est ce qui rend un souhait offrable. Le domaine
            seul : une adresse entière avec ses paramètres de suivi s'enroule
            sur quatre lignes et ne dit pas mieux chez qui aller. */}
        {adresse ? (
          <View style={styles.bloc}>
            <SectionLabel>{t.souhaitLien}</SectionLabel>
            <Pressable
              accessibilityRole="link"
              accessibilityHint={t.lienOuvreDehors}
              onPress={() => void Linking.openURL(adresse)}
              style={styles.lien}
            >
              <Icon name="link" size={15} color={couleurs.textAccent} />
              <Text style={[styles.lienTexte, { color: couleurs.textAccent }]} numberOfLines={1}>
                {domaineDuLien(adresse)}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* D'OÙ ÇA VIENT, et seulement sur une idée notée pour quelqu'un : je
            sais d'où vient ce que je demande moi-même.

            La maquette y cite la parole du proche. Le contrat ne la garde
            nulle part — `Wish` porte `origin`, pas de verbatim, ni la date à
            laquelle l'idée est arrivée. On dit donc ce qu'on sait, et rien de
            plus : inventer la citation ferait passer une supposition pour une
            confidence, ce que `origin` existe précisément pour empêcher. */}
        {origine ? (
          <Card surface="panel" padding={14} radius="lg" style={styles.bloc}>
            <SectionLabel>{t.souhaitProvenance}</SectionLabel>
            <Provenance origin={t[origine]} date={null} />
          </Card>
        ) : null}

        {/* Le geste le plus conséquent de l'écran : il rend un souhait public.
            Rien de tel sur une idée — elle ne se publie nulle part, et une
            bascule inerte y annoncerait une exposition qui n'existe pas. */}
        {mien ? (
          <View style={[styles.pied, { borderTopColor: couleurs.borderHairline }]}>
            <Bascule
              premier
              libelle={t.souhaitVisible}
              actif={ouvert.souhait.isPublic}
              onBascule={() => {
                const corps = corpsDeVisibilite(ouvert);
                if (corps) void ecrit(corps, null);
              }}
            />
            <Text style={[styles.aide, { color: couleurs.textMention }]}>
              {t.souhaitVisibleAide}
            </Text>
          </View>
        ) : (
          <View style={[styles.pied, { borderTopColor: couleurs.borderHairline }]}>
            <View style={styles.prive}>
              <Icon name="lock" size={14} color={couleurs.textMention} />
              <Text style={[styles.aide, { color: couleurs.textMention }]}>
                {t.souhaitPrive}
              </Text>
            </View>
          </View>
        )}

        <View style={{ marginTop: nativeSpace[16] }}>
          {/* Un souhait déjà offert ne se retouche plus : ni son prix ni son
              lien n'ont encore un sens à changer. */}
          <Button
            full
            variant="outline"
            icon="pencil"
            disabled={envoi || !peutRetoucher(souhait)}
            onPress={() => setEdite(true)}
          >
            {t.modifier}
          </Button>
        </View>
        <View style={{ marginTop: nativeSpace[8] }}>
          <Button
            full
            variant="destructiveOutline"
            icon="trash-2"
            disabled={envoi}
            onPress={() => setDemandeLeRetrait(true)}
          >
            {mien ? t.souhaitRetirer : t.souhaitRetirerCandidat}
          </Button>
        </View>
      </ScrollView>

      {/* La question monte AU-DESSUS de l'écran entier : posée dedans, le
          retour resterait touchable pendant qu'on demande de confirmer. */}
      {demandeLeRetrait ? (
        <ConfirmSheet
          destructif
          titre={mien ? t.souhaitRetraitTitre : t.souhaitRetirerCandidat}
          /* Retirer un souhait réservé emporte la réservation, et quelqu'un
             attend peut-être de l'offrir : la phrase le dit AVANT. */
          texte={retraitEmporteUneReservation(ouvert)
            ? `${t.souhaitRetraitTexte} ${t.souhaitRetraitReserve}`
            : mien ? t.souhaitRetraitTexte : t.souhaitRetraitIdee}
          confirmer={t.souhaitRetraitConfirmer}
          annuler={t.souhaitRetraitGarder}
          insetBas={insets.bottom}
          onConfirmer={() => void retireLeSouhait()}
          onAnnuler={() => setDemandeLeRetrait(false)}
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
  photo: {
    width: "100%", height: 160, borderRadius: nativeRadius.lg,
    marginBottom: nativeSpace[8],
  },
  titre: { fontFamily: nativeFont.displayMedium, fontSize: 22, marginTop: nativeSpace[12] },
  prix: { fontFamily: nativeFont.displayRegular, fontSize: 26, marginTop: nativeSpace[8] },
  bloc: { marginTop: nativeSpace[20] },
  pastilles: {
    flexDirection: "row", flexWrap: "wrap", gap: nativeSpace[8], marginTop: nativeSpace[10],
  },
  pastille: {
    minHeight: 38, paddingHorizontal: nativeSpace[14], justifyContent: "center",
    borderRadius: nativeRadius.pill, borderWidth: nativeBorder.width,
  },
  pastilleTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 13 },
  reservation: {
    flexDirection: "row", alignItems: "flex-start", gap: nativeSpace[10],
    marginTop: nativeSpace[14], padding: nativeSpace[14], borderRadius: nativeRadius.lg,
  },
  reservationTexte: { flex: 1, fontFamily: nativeFont.bodyRegular, fontSize: 13.5 },
  paragraphe: { fontFamily: nativeFont.bodyRegular, fontSize: 14.5, marginTop: nativeSpace[8] },
  lien: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[8],
    minHeight: nativeTouchMin,
  },
  lienTexte: { flex: 1, fontFamily: nativeFont.bodyRegular, fontSize: 14.5 },
  pied: {
    marginTop: nativeSpace[20], paddingTop: nativeSpace[14],
    borderTopWidth: nativeBorder.width,
  },
  prive: { flexDirection: "row", alignItems: "center", gap: nativeSpace[8] },
  aide: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: nativeSpace[2] },
});

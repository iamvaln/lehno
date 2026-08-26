import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { personListSchema, type Person } from "@lehno/contracts";
import {
  nativeBorder, nativeFont, nativeLetterSpacing, nativeRadius, nativeSpace,
  nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import {
  Avatar, Countdown, EmptyState, Icon, LoadingState, useCouleurs,
} from "@lehno/ui-native";
import { useLangue } from "../../../lib/langue.js";
import { appel } from "../../../lib/api.js";
import {
  PAGE, basculeDeTri, dateCourte, parametresDuCarnet, presseAssezPourSAfficher,
  resteACharger, type Tri,
} from "../../../lib/carnet.js";

/* Vos proches — le carnet.
 *
 * LE TRI ET LA PAGINATION SONT AU SERVEUR. Trier les vingt fiches reçues
 * mettrait en tête le plus proche de cette page, pas le plus proche du carnet ;
 * une fiche dont la date tombe loin sortirait de sa propre place. Le serveur
 * range aussi les fiches sans date en fin de liste, dans les deux sens.
 *
 * LE DÉCOMPTE NE PARAÎT QUE S'IL PRESSE. La spec demande de voir « qui a une
 * date qui approche », pas de classer tout le monde par échéance — sans quoi
 * cette liste redirait l'onglet Dates avec d'autres pixels.
 *
 * L'AJOUT SE TIENT SUR LA LIGNE DU TITRE. À cinquante fiches, un bouton en pied
 * de liste est hors de portée.
 *
 * Le carnet est du SOCLE : aucun drapeau ne le gouverne, il ne s'éteint jamais.
 */
export default function Proches() {
  const { t, langue } = useLangue();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();
  const routeur = useRouter();

  const [tri, setTri] = useState<Tri>({ cle: "date", sens: "asc" });
  const [proches, setProches] = useState<Person[] | null>(null);
  const [total, setTotal] = useState(0);
  const [encore, setEncore] = useState(false);

  const charge = useCallback(async (t: Tri, offset: number) => {
    const brut = await appel<unknown>(`/me/persons${parametresDuCarnet(t, offset)}`);
    const page = personListSchema.parse(brut);
    setTotal(page.total);
    setProches((v) => (offset === 0 || v === null ? page.persons : [...v, ...page.persons]));
  }, []);

  /* Changer de tri revient à la PREMIÈRE page : le serveur ne se souvient pas
     du décalage, et garder cinquante lignes ouvertes sur un ordre qu'on vient
     de quitter afficherait un carnet trié pour moitié. */
  useEffect(() => { void charge(tri, 0); }, [tri, charge]);

  /* Au retour de la fiche : un proche corrigé, ajouté ou supprimé doit se voir.
     On recharge la première page seulement — remonter tout ce qui était déplié
     ferait autant d'appels que de pages pour un changement qui tient sur une
     ligne. */
  useFocusEffect(useCallback(() => { void charge(tri, 0); }, [tri, charge]));

  const suite = async () => {
    if (encore || proches === null) return;
    setEncore(true);
    try { await charge(tri, proches.length); } finally { setEncore(false); }
  };

  const criteres = [
    { cle: "date" as const, libelle: t.triDate, sens: tri.sens === "asc" ? t.triDateProche : t.triDateLoin },
    { cle: "alpha" as const, libelle: tri.cle === "alpha" && tri.sens === "desc" ? t.triAlphaZA : t.triAlphaAZ, sens: null },
  ];

  const reste = proches ? resteACharger(total, proches.length) : 0;

  return (
    <ScrollView
      style={{ backgroundColor: couleurs.surfacePage }}
      contentContainerStyle={{
        paddingTop: insets.top + nativeSpace[20],
        paddingBottom: insets.bottom + nativeSpace[20],
        paddingHorizontal: nativeSpace[16],
      }}
    >
      <View style={[styles.entete]}>
        <Text style={[styles.titre, { color: couleurs.textBody }]}>{t.prochesTitre}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.ajouterProche}
          onPress={() => routeur.push("/(app)/proches/identite")}
          style={[styles.ajout, { backgroundColor: couleurs.action }]}
        >
          <Icon name="plus" size={19} strokeWidth={2} color={couleurs.textOnAccent} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => routeur.push("/(app)/proches/recherche")}
        style={[styles.recherche, { borderColor: couleurs.borderObject }]}
      >
        <Icon name="search" size={17} color={couleurs.textMention} />
        <Text style={[styles.rechercheTexte, { color: couleurs.textMention }]}>{t.rechercher}</Text>
      </Pressable>

      {proches === null ? (
        <View style={{ marginTop: nativeSpace[16] }}>
          <LoadingState variant="liste" rows={4} title={t.chargement} />
        </View>
      ) : proches.length === 0 ? (
        <EmptyState
          illustration="annuaire-vide"
          title={t.videAnnuaireTitre}
          text={t.videAnnuaireTexte}
          actionLabel={t.ajouterProche}
          onAction={() => routeur.push("/(app)/proches/identite")}
        />
      ) : (
        <>
          <View style={[styles.criteres]}>
            {criteres.map((c) => {
              const actif = tri.cle === c.cle;
              return (
                <Pressable
                  key={c.cle}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actif }}
                  onPress={() => setTri((v) => basculeDeTri(v, c.cle))}
                  style={[styles.critere, {
                    borderColor: actif ? "transparent" : couleurs.borderObject,
                    backgroundColor: actif ? couleurs.action : "transparent",
                  }]}
                >
                  <Text style={[styles.critereTexte, {
                    color: actif ? couleurs.textOnAccent : couleurs.textSecondary,
                  }]}>{c.libelle}</Text>
                  {actif && c.sens ? (
                    <Text style={[styles.critereSens, { color: couleurs.textOnAccent }]}>{c.sens}</Text>
                  ) : null}
                  {actif ? (
                    <Icon
                      name={tri.sens === "asc" ? "arrow-up" : "arrow-down"}
                      size={13}
                      color={couleurs.textOnAccent}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {proches.map((p, rang) => {
            const jours = p.nextOccurrence?.daysUntil ?? null;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() => routeur.push({ pathname: "/(app)/proches/[id]", params: { id: p.id } })}
                style={[styles.ligne, rang ? {
                  borderTopWidth: nativeBorder.width, borderTopColor: couleurs.borderHairline,
                } : null]}
              >
                <Avatar name={p.displayName} size={44} {...(p.avatarUrl ? { source: p.avatarUrl } : {})} />
                <View style={[styles.identite]}>
                  <Text style={[styles.nom, { color: couleurs.textBody }]} numberOfLines={1}>
                    {p.displayName}
                  </Text>
                  {/* Ce qui définit un proche, c'est ce qu'on sait de lui. La
                      date vient après, en repère. */}
                  <Text style={[styles.sousLigne, { color: couleurs.textSecondary }]} numberOfLines={1}>
                    {p.notesCount ? t.procheNotes(p.notesCount) : t.procheAucuneNote}
                    {p.nextOccurrence ? ` · ${dateCourte(p.nextOccurrence.occurrenceDate, langue)}` : ""}
                  </Text>
                </View>
                {/* « Compléter » remplace le décompte quand il n'y a aucune
                    date : la ligne dit ce qui manque au lieu de laisser un vide
                    qu'on prendrait pour un défaut d'affichage. */}
                {p.nextOccurrence === null ? (
                  <Text style={[styles.completer, { color: couleurs.textAccent }]}>{t.completer}</Text>
                ) : presseAssezPourSAfficher(jours) ? (
                  <Countdown
                    size="s"
                    today={jours === 0}
                    label={jours === 0 ? t.aujourdhui : t.decompteBarre(jours ?? 0)}
                  />
                ) : null}
                <Icon name="chevron-right" size={15} color={couleurs.textMention} />
              </Pressable>
            );
          })}

          {reste > 0 ? (
            <Pressable
              accessibilityRole="button"
              disabled={encore}
              onPress={() => void suite()}
              style={[styles.suite, { borderColor: couleurs.borderObject, opacity: encore ? 0.5 : 1 }]}
            >
              <Text style={[styles.suiteTexte, { color: couleurs.textAccent }]}>
                {t.prochesReste(reste)}
              </Text>
              <Icon name="chevron-down" size={15} color={couleurs.textAccent} />
            </Pressable>
          ) : total > PAGE ? (
            // Le total ne s'inscrit qu'une fois tout déplié : l'annoncer plus
            // tôt ferait un chiffre qui ne correspond à rien de visible.
            <Text style={[styles.total, { color: couleurs.textMention }]}>{t.prochesCompte(total)}</Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: "row", alignItems: "center", gap: nativeSpace[12], marginBottom: nativeSpace[20] },
  titre: {
    flex: 1, fontFamily: nativeFont.displayMedium, fontSize: 27,
    letterSpacing: nativeLetterSpacing(27, nativeTracking.display),
  },
  ajout: {
    width: nativeTouchMin, height: nativeTouchMin, borderRadius: nativeRadius.pill,
    alignItems: "center", justifyContent: "center",
  },
  recherche: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[8],
    minHeight: nativeTouchMin, paddingHorizontal: nativeSpace[14],
    borderRadius: nativeRadius.sm, borderWidth: nativeBorder.width,
  },
  rechercheTexte: { fontFamily: nativeFont.bodyRegular, fontSize: 15 },
  criteres: { flexDirection: "row", gap: nativeSpace[8], marginTop: nativeSpace[20], marginBottom: nativeSpace[4] },
  critere: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[4],
    paddingVertical: nativeSpace[6], paddingHorizontal: nativeSpace[12],
    borderRadius: nativeRadius.pill, borderWidth: nativeBorder.width,
  },
  critereTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 12.5 },
  critereSens: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, opacity: 0.85 },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: nativeSpace[12],
    paddingVertical: nativeSpace[12], minHeight: nativeTouchMin,
  },
  identite: { flex: 1, minWidth: 0 },
  nom: { fontFamily: nativeFont.displayRegular, fontSize: 17 },
  sousLigne: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, marginTop: 2 },
  completer: { fontFamily: nativeFont.bodySemibold, fontSize: 12.5 },
  suite: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: nativeSpace[6],
    minHeight: nativeTouchMin, marginTop: nativeSpace[12],
    borderRadius: nativeRadius.sm, borderWidth: nativeBorder.width,
  },
  suiteTexte: { fontFamily: nativeFont.bodySemibold, fontSize: 14 },
  total: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, textAlign: "center", marginTop: nativeSpace[12] },
});

import { Image, Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { ThemeProvider } from "../ThemeProvider.js";
import { Wordmark } from "./Wordmark.js";
import {
  AMBIANCES, BOITE_DE_SCENE, SCENES, THEME_DU_PORTRAIT,
  type AmbianceDePortrait, type Ambiance, type FamilleIllustree, type FormatDePortrait,
  type FormeDeScene, type StyleDePhoto, type VoieDePortrait,
} from "./PortraitComposition.data.js";
import {
  HAMPE, REGISTRE, encresDeLaScene, hampesDeLaTrame, lignesDesRegistres,
  motifDuPortrait, styleDuPortrait, texteDuPortrait, traitementDePhoto,
} from "./PortraitComposition.styles.js";

export interface PortraitCompositionProps {
  /** Le nom d'usage du proche. La taille s'ajuste seule. */
  nom: string;
  /** Le message — le contenu principal. Deux à quatre phrases. */
  message: string;
  /** La version courte, pour le format vertical. */
  messageCourt?: string | undefined;
  /** Le mot de qui offre le portrait. Facultatif ; le pied se comprime sans lui. */
  note?: string | undefined;
  /** La mention du pied — « lehno.app · @lehno.app ». Elle vient de l'appel. */
  mention: string;
  ambiance?: AmbianceDePortrait | undefined;
  format?: FormatDePortrait | undefined;
  /** Une seule voie d'image à la fois : les mêler ferait une infographie. */
  voie?: VoieDePortrait | undefined;
  famille?: FamilleIllustree | undefined;
  stylePhoto?: StyleDePhoto | undefined;
  /** L'image de l'utilisateur, quand `voie` vaut « photo ». */
  photo?: string | undefined;
  /** Une occasion sensible : l'abricot cède, rien de vif. */
  hommage?: boolean | undefined;
  /** La largeur de la composition, en points. Tout s'en déduit. */
  largeur: number;
}

/* Le portrait, en une image fixe.
 *
 * IL N'A PAS DE PROP POUR MASQUER LA MARQUE, et il n'en aura pas : le portrait
 * circule hors de l'application, chez des gens qui n'ont jamais entendu parler
 * de Lehno. C'est le seul contenu qui sort en la portant.
 *
 * IL ÉPINGLE SON THÈME. L'ambiance est un choix de l'utilisateur, pas un
 * réglage du téléphone : sans cet épinglage, la marque du pied prendrait
 * l'encre du thème sombre et s'effacerait sur le papier blanc.
 */
export function PortraitComposition({
  nom, message, messageCourt, note, mention,
  ambiance = "papier", format = "carre", voie = "illustration",
  famille = "nature", stylePhoto = "silhouette", photo, hommage = false, largeur,
}: PortraitCompositionProps) {
  const A = AMBIANCES[ambiance];
  const texte = texteDuPortrait({ message, ...(messageCourt !== undefined ? { messageCourt } : {}), format });
  const s = styleDuPortrait({ ambiance, format, voie, nom, message: texte, largeur });
  const sansImage = motifDuPortrait(voie) === "registres";

  /* L'ORDRE N'EST PAS NÉGOCIABLE : le nom du proche, le message, la note de
     l'expéditeur, le pied de marque. Le nom d'abord parce que c'est de cette
     personne qu'il s'agit ; le pied en dernier parce que le portrait appartient
     à celui qui l'offre. */
  const contenu = (
    <>
      <Text style={s.nom}>{nom}</Text>
      <Text style={s.message}>{texte}</Text>
      {note ? <Text style={s.note}>{note}</Text> : null}
      <View style={s.pied}>
        <Wordmark variant={A.marque} height={s.hauteurDeLaMarque} />
        <Text style={s.mention}>{mention}</Text>
      </View>
    </>
  );

  return (
    // Le thème épinglé : le portrait est une image, pas un écran.
    <ThemeProvider choix={THEME_DU_PORTRAIT}>
      <View style={s.cadre} accessibilityRole="image" accessibilityLabel={`${nom} — ${texte}`}>
        {sansImage ? (
          <View style={s.bande}>
            <Motif sorte="registres" ambiance={A} largeur={largeur} hauteur={s.hauteur} />
            <Voile couleur={A.voile} opacite={A.opaciteVoileSansImage} />
            <View style={s.contenu}>{contenu}</View>
          </View>
        ) : (
          <>
            <View style={s.image}>
              {voie === "photo" ? (
                <Photo ambiance={A} style={stylePhoto} source={photo} />
              ) : (
                <Scene ambiance={A} famille={famille} hommage={hommage} />
              )}
            </View>
            <View style={s.bande}>
              {/* La trame est le seul motif qui accepte du texte par-dessus,
                  et le voile garantit qu'on le lit. */}
              <Motif sorte="trame" ambiance={A} largeur={largeur} hauteur={s.hauteur} />
              <Voile couleur={A.voile} opacite={A.opaciteVoile} />
              <View style={s.contenu}>{contenu}</View>
            </View>
          </>
        )}
      </View>
    </ThemeProvider>
  );
}

const REMPLISSAGE = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

function Voile({ couleur, opacite }: { couleur: string; opacite: number }) {
  return <View style={[REMPLISSAGE, { backgroundColor: couleur, opacity: opacite }]} />;
}

/* Le motif se dessine en positions plutôt qu'en `<pattern>` : la bande n'a pas
   de hauteur connue d'avance — elle dépend de la longueur du message — et un
   motif calé sur une hauteur supposée laisse une bande chauve dès que le texte
   passe à quatre lignes. La boîte prend la hauteur entière du portrait, dont la
   bande ne montre que sa part. */
function Motif({
  sorte, ambiance, largeur, hauteur,
}: {
  sorte: "trame" | "registres";
  ambiance: Ambiance;
  largeur: number;
  hauteur: number;
}) {
  return (
    <Svg style={REMPLISSAGE} width={largeur} height={hauteur} opacity={ambiance.opaciteMotif}>
      {sorte === "trame"
        ? hampesDeLaTrame(largeur, hauteur).map((h, rang) => (
            <Rect
              key={rang} x={h.x} y={h.y} width={HAMPE.largeur} height={HAMPE.hauteur}
              rx={HAMPE.rayon} fill={ambiance.motif}
            />
          ))
        : lignesDesRegistres(hauteur).map((y, rang) => (
            <Rect
              key={rang} x={0} y={y} width={largeur} height={REGISTRE.hauteur}
              fill={ambiance.motif}
            />
          ))}
    </Svg>
  );
}

function Scene({
  ambiance, famille, hommage,
}: { ambiance: Ambiance; famille: FamilleIllustree; hommage: boolean }) {
  const encres = encresDeLaScene(ambiance, hommage);
  const rendre = ([tag, attrs]: FormeDeScene, rang: number) => {
    const fill = encres[attrs.fill];
    switch (tag) {
      case "path":
        return (
          <Path
            key={rang} d={attrs.d} fill={fill}
            {...(attrs.opacity !== undefined ? { opacity: attrs.opacity } : {})}
          />
        );
      case "rect":
        return (
          <Rect
            key={rang} x={attrs.x} y={attrs.y} width={attrs.width} height={attrs.height} fill={fill}
          />
        );
      default:
        return <Circle key={rang} cx={attrs.cx} cy={attrs.cy} r={attrs.r} fill={fill} />;
    }
  };

  return (
    <Svg
      width="100%" height="100%"
      viewBox={`0 0 ${BOITE_DE_SCENE.largeur} ${BOITE_DE_SCENE.hauteur}`}
      // Le sujet vit entre y=3 et y=27 : ce qui déborde au rognage n'est jamais
      // ce qui porte la scène.
      preserveAspectRatio="xMidYMid slice"
    >
      <Rect
        width={BOITE_DE_SCENE.largeur} height={BOITE_DE_SCENE.hauteur} fill={encres.clair}
      />
      {SCENES[famille].map(rendre)}
    </Svg>
  );
}

/* La photo : une illustration DÉRIVÉE de la photo, pas un filtre. La silhouette
   passe par `tintColor` — l'image entière prend une encre, ce que le web
   approchait par un contraste poussé à 4. Les deux autres gardent leur teinte
   en voile ; la désaturation, elle, n'a pas d'équivalent natif. */
function Photo({
  ambiance, style, source,
}: { ambiance: Ambiance; style: StyleDePhoto; source?: string | undefined }) {
  const t = traitementDePhoto(style, ambiance);
  const encres = encresDeLaScene(ambiance);

  return (
    <View style={[REMPLISSAGE, { backgroundColor: encres.clair, overflow: "hidden" }]}>
      {source ? (
        <Image
          source={{ uri: source }}
          resizeMode="cover"
          style={[REMPLISSAGE, ...(t.monochrome ? [{ tintColor: t.teinte }] : [])]}
        />
      ) : null}
      {t.monochrome ? null : <Voile couleur={t.teinte} opacite={t.opacite} />}
    </View>
  );
}

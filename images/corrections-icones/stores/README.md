# Lehno — visuels de boutique

Le signe est posé à pleine page sur le violet #7B6BB7 : les boutiques appliquent elles-mêmes l'arrondi et le masque. Les deux icônes de fiche (iOS 1024, Play 512) sont encodées sans canal alpha, comme les boutiques l'exigent.

## iOS — `ios/`

| Fichier | Emplacement |
|---|---|
| `lehno-app-icon-1024.png` | Fiche App Store · App Icon dans Xcode |
| `lehno-app-icon-180.png` | iPhone @3x |
| `lehno-app-icon-120.png` | iPhone @2x |
| `lehno-app-icon-167.png` | iPad Pro |
| `lehno-app-icon-152.png` | iPad @2x |
| `lehno-app-icon-76.png` | iPad @1x |

## Android — `android/`

| Fichier | Emplacement |
|---|---|
| `play-store-icon-512.png` | Fiche Play Store |
| `play-feature-graphic-1024x500.png` | Bandeau de la fiche |
| `adaptive-foreground-432.png` | `ic_launcher_foreground` — le signe, transparent, tenu dans la zone sûre de 264 px |
| `adaptive-background-432.png` | `ic_launcher_background` — violet plein |
| `launcher-192.png` … `launcher-48.png` | Rétrocompatibilité `mipmap-*`, pour les lanceurs sans icône adaptative |

Tous les paliers viennent du **même tracé** que le logotype. Sous 128 px, seul le *trait*
s'épaissit — d'une part calculée sur le canal, l'espace entre la hampe et la jambe droite,
et jamais plus du quart de sa largeur. Les empattements ne sont jamais retirés : une icône
qui les perd devient un autre `h`.

## Captures d'écran

Les captures des deux boutiques se produisent depuis l'application, pas depuis la marque. Formats attendus : iPhone 6,7″ 1290 × 2796, iPad 12,9″ 2048 × 2732, Play 1080 × 1920 minimum, huit visuels par boutique au plus.

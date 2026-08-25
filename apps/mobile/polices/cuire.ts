/* Cuire les instances statiques des polices de marque.
 *
 *   pnpm --filter @lehno/mobile polices
 *
 * Prérequis : la ligne de commande fontTools.
 *   python3 -m venv .venv && .venv/bin/pip install fonttools
 *   PATH="$PWD/.venv/bin:$PATH" pnpm --filter @lehno/mobile polices
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * Fraunces est une variable, et la marque en emploie une instance précise —
 * SOFT 40, WONK 1, celle du logotype. React Native ne connaît pas
 * fontVariationSettings, et le support des variables reste irrégulier sur
 * Android : les axes doivent donc être figés dans le fichier. Les cuire à la
 * main serait un travail refait à chaque évolution de la charte ; ici la charte
 * change et les polices se recompilent.
 *
 * RIEN N'EST ÉCRIT EN DUR
 *
 * Les noms de fichiers viennent de `nativeFont`, les graisses des jetons de
 * typographie, et l'instance de marque se lit dans `fontDisplaySettings`. Un
 * nom qui divergerait du nom demandé par les styles ne lèverait aucune erreur :
 * le système rendrait sa police par défaut, et l'identité tomberait en silence.
 *
 * LICENCE
 *
 * Fraunces et Karla sont sous SIL OFL 1.1. Ni l'une ni l'autre ne déclare de
 * Reserved Font Name — vérifié dans la notice de copyright de leur OFL.txt, où
 * la mention « with Reserved Font Name » est absente. Les instances dérivées
 * peuvent donc garder les noms d'origine. L'OFL exige que la licence accompagne
 * les fichiers dérivés : le script la copie à côté d'eux.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeFont, typography } from "@lehno/tokens";

const ICI = dirname(fileURLToPath(import.meta.url));
const SOURCES = join(ICI, "sources");

// Les dépôts amont sont épinglés à un commit : « master » livrerait un jour
// d'autres contours, et les polices cuites cesseraient d'être reproductibles.
const AMONT = {
  Fraunces: {
    depot: "googlefonts/fraunces",
    commit: "ad58030f7daa4d12f14f4c059b7ed1205e28105c",
    licence: "OFL.txt",
    romain: "fonts/Fraunces[SOFT,WONK,opsz,wght].ttf",
    italique: "fonts/Fraunces-Italic[SOFT,WONK,opsz,wght].ttf",
  },
  Karla: {
    depot: "googlefonts/karla",
    commit: "69b25f663101efb4113dd7ed416c120dd2dce56a",
    licence: "OFL.txt",
    romain: "fonts/variable/Karla[wght].ttf",
    italique: null,
  },
} as const;

/* Une seule coupe optique. L'application emploie Fraunces entre 18 et 38 px, et
   24 est au milieu de cette plage. Le portrait généré monte plus haut : une
   seconde coupe à opsz 72 l'améliorerait, mais elle ne concerne qu'un écran et
   doublerait le poids embarqué. C'est la seule valeur de ce fichier qui soit un
   choix natif plutôt qu'une lecture de la charte. */
const COUPE_OPTIQUE = 24;

/* « "SOFT" 40, "WONK" 1 » — l'instance de marque, telle que la charte l'écrit
   pour le web. La lire évite qu'elle existe à deux endroits. */
function instanceDeMarque(): Record<string, number> {
  const axes: Record<string, number> = {};
  for (const [, axe, valeur] of typography.fontDisplaySettings.matchAll(/"(\w+)"\s+([\d.]+)/g)) {
    axes[axe!] = Number(valeur);
  }
  return axes;
}

/* La graisse d'une instance se lit dans les jetons : « displayMedium » renvoie
   à `fontDisplayMedium`. Les deux italiques n'ont pas de jeton — le web les
   obtient par fontStyle — et empruntent donc celle de leur romaine. */
const ROMAINE_DE_L_ITALIQUE: Record<string, string> = {
  displayItalic: "displayRegular",
  displayMediumItalic: "displayMedium",
};

function graisse(cle: string): number {
  const romaine = ROMAINE_DE_L_ITALIQUE[cle] ?? cle;
  const nom = "font" + romaine.slice(0, 1).toUpperCase() + romaine.slice(1);
  const valeur = (typography as Record<string, string>)[nom];
  // Le contrôle numérique compte : « fontDisplay » existe aussi, et porte la
  // pile de familles. Une graisse à NaN passerait jusqu'à fontTools.
  if (!valeur || !/^\d+$/.test(valeur)) {
    throw new Error(`Aucun jeton de graisse pour ${cle} (cherché : ${nom})`);
  }
  return Number(valeur);
}

async function recuperer(url: string, vers: string): Promise<void> {
  if (existsSync(vers)) return;
  process.stdout.write(`  ↓ ${url.split("/").pop()}\n`);
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`${reponse.status} sur ${url}`);
  writeFileSync(vers, Buffer.from(await reponse.arrayBuffer()));
}

async function main(): Promise<void> {
  mkdirSync(SOURCES, { recursive: true });

  console.log("Sources amont");
  for (const [famille, amont] of Object.entries(AMONT)) {
    const brut = `https://raw.githubusercontent.com/${amont.depot}/${amont.commit}`;
    await recuperer(`${brut}/${amont.romain}`, join(SOURCES, `${famille}.ttf`));
    if (amont.italique) {
      await recuperer(`${brut}/${amont.italique}`, join(SOURCES, `${famille}-Italic.ttf`));
    }
    // L'OFL exige que la licence accompagne les fichiers dérivés.
    await recuperer(`${brut}/${amont.licence}`, join(ICI, `OFL-${famille}.txt`));
  }

  const marque = instanceDeMarque();
  console.log("\nInstances");

  for (const [cle, nom] of Object.entries(nativeFont)) {
    const famille = nom.split("-")[0] as keyof typeof AMONT;
    const italique = nom.endsWith("Italic");
    const source = join(SOURCES, italique ? `${famille}-Italic.ttf` : `${famille}.ttf`);

    // Fraunces porte l'instance de marque et la coupe optique ; Karla n'a qu'un
    // axe de graisse, et lui passer SOFT ou opsz ferait échouer l'outil.
    const axes =
      famille === "Fraunces"
        ? { ...marque, opsz: COUPE_OPTIQUE, wght: graisse(cle) }
        : { wght: graisse(cle) };

    const arguments_ = Object.entries(axes).map(([axe, valeur]) => `${axe}=${valeur}`);
    execFileSync(
      "fonttools",
      ["varLib.instancer", source, ...arguments_, "-o", join(ICI, `${nom}.ttf`)],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    console.log(`  ✓ ${nom}.ttf   ${arguments_.join(" ")}`);
  }
}

main().catch((erreur: unknown) => {
  const message = erreur instanceof Error ? erreur.message : String(erreur);
  console.error(`\nLa cuisson a échoué : ${message}`);
  if (message.includes("ENOENT")) {
    console.error("fontTools est-il sur le PATH ? Voir l'en-tête de ce fichier.");
  }
  process.exit(1);
});

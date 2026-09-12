import { PrismaClient } from "@prisma/client";
import { TYPES_CLIENT, type TypeClient } from "@lehno/contracts";

/* ENREGISTRER UNE VERSION — à lancer par la chaîne de publication.
 *
 * IL TOURNE AVANT LA SOUMISSION AU MAGASIN, JAMAIS APRÈS. C'est ce qui rend rare
 * le cas que le registre rend dangereux : un build parti au magasin sans être
 * enregistré inviterait tous ses utilisateurs à « mettre à jour » vers une
 * version qu'ils ont déjà. Au moment où le premier d'entre eux lance
 * l'application, elle doit être connue.
 *
 * IL EST REJOUABLE : un `(plateforme, build)` déjà enregistré est mis à jour,
 * pas dupliqué — une CI qui rejoue une étape ne doit ni créer un doublon ni
 * échouer.
 *
 * `--forces-update` NE SE DEVINE PAS. C'est une décision humaine, prise en
 * écrivant la release : le script ne l'infère d'aucune convention de commit,
 * parce qu'une rupture mal détectée bloque tout le monde dans un sens, et laisse
 * casser en silence dans l'autre.
 *
 *   pnpm --filter @lehno/api exec tsx src/scripts/enregistrer-version.ts \
 *     --platform mobile_ios --version 1.4.2 --build 412 \
 *     --store-url https://apps.apple.com/... [--forces-update] [--notes "…"]
 */

type Options = {
  platform: TypeClient;
  version: string;
  build: number;
  storeUrl?: string;
  notes?: string;
  forcesUpdate: boolean;
};

function lireLesArguments(argv: string[]): Options {
  const valeurs = new Map<string, string>();
  const drapeaux = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const suivant = argv[i + 1];
    if (suivant === undefined || suivant.startsWith("--")) drapeaux.add(a.slice(2));
    else { valeurs.set(a.slice(2), suivant); i += 1; }
  }

  const exige = (nom: string): string => {
    const v = valeurs.get(nom);
    if (v === undefined) throw new Error(`--${nom} est requis`);
    return v;
  };

  const platform = exige("platform");
  if (!(TYPES_CLIENT as readonly string[]).includes(platform))
    throw new Error(`--platform doit valoir ${TYPES_CLIENT.join(" | ")}`);

  /* LE BUILD EST UN ENTIER, ET LE VÉRIFIER ICI N'EST PAS DU ZÈLE : un
     `--build 1.4.2` passé par mégarde donnerait `NaN`, et une comparaison contre
     `NaN` est toujours fausse — la version serait servie à tout le monde sans
     que rien ne le signale. */
  const build = Number(exige("build"));
  if (!Number.isInteger(build) || build <= 0)
    throw new Error("--build doit être un entier positif (CFBundleVersion, versionCode, nombre de commits)");

  return {
    platform: platform as TypeClient,
    version: exige("version"),
    build,
    ...(valeurs.has("store-url") ? { storeUrl: valeurs.get("store-url")! } : {}),
    ...(valeurs.has("notes") ? { notes: valeurs.get("notes")! } : {}),
    forcesUpdate: drapeaux.has("forces-update"),
  };
}

async function principal(): Promise<void> {
  const options = lireLesArguments(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const avant = await prisma.appVersion.findUnique({
      where: {
        platform_buildNumber: {
          platform: options.platform as never, buildNumber: options.build,
        },
      },
      select: { id: true },
    });

    const ligne = await prisma.appVersion.upsert({
      where: {
        platform_buildNumber: {
          platform: options.platform as never, buildNumber: options.build,
        },
      },
      create: {
        platform: options.platform as never,
        version: options.version,
        buildNumber: options.build,
        forcesUpdate: options.forcesUpdate,
        ...(options.storeUrl === undefined ? {} : { storeUrl: options.storeUrl }),
        ...(options.notes === undefined ? {} : { notes: options.notes }),
      },
      update: {
        version: options.version,
        forcesUpdate: options.forcesUpdate,
        ...(options.storeUrl === undefined ? {} : { storeUrl: options.storeUrl }),
        ...(options.notes === undefined ? {} : { notes: options.notes }),
      },
    });

    console.log(
      `${avant === null ? "enregistrée" : "mise à jour"}  ` +
      `${ligne.platform}  ${ligne.version}  build ${ligne.buildNumber}` +
      `${ligne.forcesUpdate ? "  ⚠ FORCE LA MISE À JOUR" : ""}`,
    );

    if (ligne.forcesUpdate) {
      /* On le dit fort, parce que le script ne montre PAS combien d'appareils
         sont concernés — le panneau, lui, le fait. Poser ce drapeau depuis une
         chaîne de publication, c'est le poser sans regarder. */
      console.log("");
      console.log("  Tous les builds antérieurs de cette plateforme cessent d'être servis.");
      console.log("  Le panneau d'administration dit combien de comptes en sont affectés ;");
      console.log("  ce script, non.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

await principal();

import { PrismaClient } from "@prisma/client";
import { engendrerUneCle, hacherLaCle } from "../clients/client-api.service.js";

/* SEMER LES SIX PAIRES — trois plateformes × deux environnements.
 *
 * Pourquoi six et pas une par build : la version n'entre pas dans l'identité,
 * elle voyage dans `x-app-version`. Une paire par build permettrait de couper
 * une version précise, mais demanderait d'en créer une à chaque publication et
 * de la porter dans la chaîne de compilation.
 *
 * IL AFFICHE LES CLÉS UNE SEULE FOIS, et c'est tout l'objet de ce script : la
 * base n'en garde que le haché, donc ce qui s'affiche ici ne se relit nulle
 * part. Copiez-les avant de fermer le terminal.
 *
 * IL EST REJOUABLE SANS DANGER : un client déjà présent est laissé tel quel,
 * clé comprise. Rejouer ne doit pas invalider en silence les paires qui
 * tournent déjà en production — pour remplacer une clé, il y a la rotation au
 * panneau, qui demande un motif et laisse une trace.
 *
 *   pnpm --filter @lehno/api exec tsx src/scripts/semer-clients-api.ts
 */

const PLATEFORMES = [
  { type: "mobile_ios", nom: "Application iOS" },
  { type: "mobile_android", nom: "Application Android" },
  { type: "web", nom: "Site web" },
] as const;

const ENVIRONNEMENTS = ["staging", "prod"] as const;

async function principal(): Promise<void> {
  const prisma = new PrismaClient();
  const neuves: { clientId: string; cle: string; quoi: string }[] = [];

  try {
    for (const plateforme of PLATEFORMES) {
      for (const env of ENVIRONNEMENTS) {
        const label = `${plateforme.nom} — ${env}`;

        /* On cherche par (type, environnement) et NON par identifiant : celui-ci
           porte un suffixe aléatoire, donc le recalculer ne retrouverait jamais
           une ligne existante — et le semis créerait six paires de plus à chaque
           passage. */
        const existant = await prisma.apiClient.findFirst({
          where: { clientType: plateforme.type, environment: env },
          select: { clientId: true },
        });
        if (existant !== null) {
          console.log(`  déjà là   ${label.padEnd(32)} ${existant.clientId}`);
          continue;
        }

        const cle = engendrerUneCle();
        const ligne = await prisma.apiClient.create({
          data: {
            clientId: `${plateforme.type}_${env}_${Math.random().toString(16).slice(2, 10)}`,
            label,
            clientType: plateforme.type,
            environment: env,
            keyHash: hacherLaCle(cle),
          },
          select: { clientId: true },
        });
        neuves.push({ clientId: ligne.clientId, cle, quoi: label });
        console.log(`  créée     ${label.padEnd(32)} ${ligne.clientId}`);
      }
    }

    if (neuves.length === 0) {
      console.log("\nRien de neuf : les six paires existent déjà.");
      return;
    }

    console.log(`\n${"─".repeat(72)}`);
    console.log("LES CLÉS CI-DESSOUS NE SE RELISENT NULLE PART. Copiez-les maintenant.");
    console.log("La base n'en garde que le haché — une clé perdue se remplace par la");
    console.log("rotation au panneau, elle ne se récupère pas.");
    console.log("─".repeat(72));
    for (const n of neuves) {
      console.log(`\n${n.quoi}`);
      console.log(`  x-client-id : ${n.clientId}`);
      console.log(`  x-client-key: ${n.cle}`);
    }
    console.log("");
  } finally {
    await prisma.$disconnect();
  }
}

await principal();

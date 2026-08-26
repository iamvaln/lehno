import "../src/env.js";
import { PrismaClient } from "@prisma/client";

/* Un carnet de démonstration, pour développer contre le VRAI volume.
 *
 * Le handoff des proches le dit : l'état « carnet fourni » compte quarante-trois
 * fiches, « là pour développer contre le vrai volume, pas contre cinq lignes ».
 * Avec cinq fiches, la pagination ne se déclenche jamais, « Voir plus · n
 * restants » ne paraît pas, et le tri se vérifie à l'œil sans rien prouver.
 *
 * Ce script ne crée AUCUN compte : il remplit celui qu'on lui désigne, pour
 * qu'on traverse l'inscription pour de vrai et qu'on trouve ensuite un carnet
 * garni. Créer le compte ici court-circuiterait le parcours qu'on veut voir.
 *
 *   node --import tsx/esm scripts/semer-carnet.ts <adresse-du-compte>
 *
 * Rejouable : il efface d'abord ce qu'il avait semé pour ce compte. Sans quoi
 * un second passage donnerait quatre-vingt-six fiches et un carnet qui ne
 * ressemble plus à rien.
 */

const prisma = new PrismaClient();

// La marque du semis. Elle permet d'effacer ce que le script a créé sans
// toucher aux fiches saisies à la main entre deux passages.
const MARQUE = "[semis]";

const PRENOMS = [
  "Célarine", "Valery", "Awa", "Émile", "Quentin", "Zoé", "Nadège", "Ibrahim",
  "Léa", "Ousmane", "Christelle", "Bertrand", "Aïcha", "Marius", "Fadila",
  "Serge", "Ngozi", "Théo", "Mariam", "Yann", "Solange", "Kofi", "Élodie",
  "Bakary", "Justine", "Armand", "Rokhaya", "Étienne", "Chantal", "Moussa",
  "Perrine", "Idriss", "Blandine", "Amadou", "Sylvie", "Franck", "Oumou",
  "Grégoire", "Danielle", "Hamza", "Josiane", "Patrick", "Nabou",
];

const RELATIONS = [
  "famille_proche", "famille_etendue", "ami", "partenaire",
  "collegue", "relation_pro", "connaissance",
] as const;

const VILLES = ["Douala", "Yaoundé", "Paris", "Dakar", "Abidjan", "Lyon", "Bafoussam"];

/* Des notes qui ressemblent à de vraies notes : ce sont elles que la
   génération lira un jour, et une note d'essai qui ne dit rien ne dirait rien
   non plus à la relecture d'un écran. */
const NOTES = [
  "a parlé d'un cours de céramique, tout près d'ici",
  "cherche un moulin à café manuel — le précédent rend l'âme",
  "ne boit plus de café après midi",
  "collectionne les cartes postales de bord de mer",
  "vient de reprendre la course, deux fois par semaine",
  "déteste qu'on lui offre des bougies",
  "parle d'apprendre la guitare depuis deux ans",
  "a une allergie aux fruits à coque",
];

// Une date civile à N jours d'ici, sans passer par un objet Date local :
// `new Date("2026-02-29")` s'interprète en UTC puis se décale du fuseau.
function dansNJours(n: number): string {
  const base = Math.floor(Date.now() / 86_400_000) + n;
  return new Date(base * 86_400_000).toISOString().slice(0, 10);
}

function naissancePour(jour: string, age: number): Date {
  const [, m, j] = jour.split("-") as [string, string, string];
  const annee = new Date().getUTCFullYear() - age;
  return new Date(`${annee}-${m}-${j}T00:00:00Z`);
}

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage : node --import tsx/esm scripts/semer-carnet.ts <adresse-du-compte>");
    console.error("Le compte doit exister — traversez l'inscription d'abord.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    // On ne crée pas le compte à sa place : le parcours d'inscription est
    // précisément ce qu'on veut voir tourner pour de vrai.
    console.error(`Aucun compte pour cette adresse. Traversez l'inscription, puis relancez.`);
    process.exit(1);
  }

  const efface = await prisma.person.deleteMany({
    where: { userId: user.id, relationHint: { contains: MARQUE } },
  });
  if (efface.count > 0) console.log(`  ${efface.count} fiches du semis précédent effacées`);

  /* Les distances sont CHOISIES, pas tirées au hasard :
     - deux fiches aujourd'hui même, pour la pastille du jour ;
     - cinq dans les sept jours, seules à porter le grand décompte ;
     - le gros du carnet réparti sur l'année, pour que le calendrier montre
       des périodes chargées et des périodes creuses ;
     - quatre SANS aucune date, pour éprouver « Compléter » et la règle qui
       les garde en fin de liste dans les deux sens du tri. */
  const distances: (number | null)[] = [
    0, 0, 2, 4, 5, 6, 7,
    ...Array.from({ length: 32 }, (_, i) => 12 + i * 11),
    null, null, null, null,
  ];

  let creees = 0;
  for (const [i, dans] of distances.entries()) {
    const prenom: string = PRENOMS[i % PRENOMS.length] ?? `Proche ${i}`;
    const jour = dans === null ? null : dansNJours(dans);
    const age = 24 + ((i * 7) % 45);

    const proche = await prisma.person.create({
      data: {
        userId: user.id,
        displayName: i < PRENOMS.length ? prenom : `${prenom} ${String.fromCharCode(65 + (i % 26))}`,
        // La marque voyage dans le repère de relation : c'est un texte libre
        // d'aide à la génération, et elle rend le semis effaçable.
        relationHint: `${MARQUE} rencontré à ${VILLES[i % VILLES.length] ?? "Douala"}`,
        relation: RELATIONS[i % RELATIONS.length] ?? null,
        city: VILLES[i % VILLES.length] ?? null,
        country: "CM",
        register: i % 3 === 0 ? "familier" : i % 3 === 1 ? "amical" : "formel",
        language: i % 4 === 0 ? "en" : "fr",
        // Une fiche sur cinq n'a pas d'année connue : l'écran doit tenir sans
        // âge, et l'anniversaire se suit quand même.
        ...(jour ? { birthDate: naissancePour(jour, age), birthYearKnown: i % 5 !== 0 } : {}),
      },
      select: { id: true },
    });
    creees += 1;

    if (jour) {
      const event = await prisma.event.create({
        data: {
          personId: proche.id,
          kind: "birthday",
          // Une fiche sur onze porte une nature sensible : le ton change, et
          // l'écran doit le montrer autrement qu'en théorie.
          eventNature: i % 11 === 0 ? "sensitive" : "happy",
          referenceDate: new Date(`${jour}T00:00:00Z`),
        },
        select: { id: true },
      });
      await prisma.eventOccurrence.create({
        data: {
          eventId: event.id,
          userId: user.id,
          occurrenceDate: new Date(`${jour}T00:00:00Z`),
          occurrenceYear: Number(jour.slice(0, 4)),
        },
      });
    }

    // Un nombre de notes VARIÉ, y compris zéro : la ligne doit savoir dire
    // « Aucune note » autant que « 3 notes », et les deux se dessinent.
    const combien = i % 4;
    for (let n = 0; n < combien; n += 1) {
      await prisma.note.create({
        // `Note` ne porte pas d'userId : son appartenance passe par le proche,
        // exactement comme la portée cloisonnée du dépôt la lit.
        data: {
          personId: proche.id,
          authorUserId: user.id,
          content: `${prenom} ${NOTES[(i + n) % NOTES.length] ?? "a parlé de voyages"}.`,
        },
      });
    }
  }

  const total = await prisma.person.count({ where: { userId: user.id } });
  console.log(`  ${creees} fiches semées — ${total} au carnet`);
  console.log(`  2 aujourd'hui, 5 sous sept jours, 4 sans date, 1 sur 11 sensible`);
  await prisma.$disconnect();
}

await main();

// L'arithmétique des dates civiles, en chaînes « YYYY-MM-DD ».
//
// Aucun objet Date de bout en bout, et c'est délibéré : « new Date("2026-02-29") »
// s'interprète en UTC puis se décale du fuseau local. Une échéance changerait
// alors de jour selon l'endroit d'où on la regarde, et le dictionnaire est
// formel — « le calcul se fait en dates civiles, dans le fuseau de
// l'utilisateur ». Une chaîne n'a pas de fuseau, donc rien à décaler.

export type UniteRegle = "day" | "week" | "month" | "quarter" | "year";
export type Regle = { unite: UniteRegle; pas: number };

function decomposer(date: string): [number, number, number] {
  const [a, m, j] = date.split("-").map(Number);
  if (a === undefined || m === undefined || j === undefined || Number.isNaN(a))
    throw new Error(`date civile attendue au format YYYY-MM-DD, reçu « ${date} »`);
  return [a, m, j];
}

function composer(a: number, m: number, j: number): string {
  return `${String(a).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}

// Bissextile : divisible par 4, sauf les siècles non divisibles par 400.
// 1900 ne l'était pas, 2000 l'était.
function bissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

function joursDuMois(annee: number, mois: number): number {
  const longueurs = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mois === 2 && bissextile(annee)) return 29;
  return longueurs[mois - 1] as number;
}

// Les jours s'ajoutent sans piège : un jour dure un jour, et la date civile
// n'a ni heure d'été ni fuseau. On compte en jours depuis une origine.
function versJourJulien(a: number, m: number, j: number): number {
  const a2 = m <= 2 ? a - 1 : a;
  const m2 = m <= 2 ? m + 12 : m;
  const siecle = Math.floor(a2 / 100);
  const correction = 2 - siecle + Math.floor(siecle / 4);
  return (
    Math.floor(365.25 * (a2 + 4716)) +
    Math.floor(30.6001 * (m2 + 1)) +
    j + correction - 1524
  );
}

function depuisJourJulien(jj: number): [number, number, number] {
  const a = jj + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return [
    100 * b + d - 4800 + Math.floor(m / 10),
    m + 3 - 12 * Math.floor(m / 10),
    e - Math.floor((153 * m + 2) / 5) + 1,
  ];
}

export function ajouterJours(date: string, n: number): string {
  const [a, m, j] = decomposer(date);
  const [a2, m2, j2] = depuisJourJulien(versJourJulien(a, m, j) + n);
  return composer(a2, m2, j2);
}

// Ajouter des mois demande une décision : que faire du 31 janvier quand on
// arrive en février ? Le dictionnaire tranche — « ramenée au dernier jour de
// ce mois ». Un 29 février se marque donc le 28 les années communes.
export function ajouterMois(date: string, n: number): string {
  const [a, m, j] = decomposer(date);
  const total = (a * 12 + (m - 1)) + n;
  const anneeCible = Math.floor(total / 12);
  const moisCible = (total % 12) + 1;
  const dernier = joursDuMois(anneeCible, moisCible);
  return composer(anneeCible, moisCible, Math.min(j, dernier));
}

// Les `combien` prochaines échéances à partir de `depuis` (inclus).
//
// Chaque échéance se calcule DEPUIS LA RÉFÉRENCE, en multipliant le pas —
// jamais depuis l'échéance précédente. C'est ce qui empêche la dérive : un
// calcul itératif donnerait 31 janvier → 28 février → 28 mars → 28 avril, et
// l'anniversaire glisserait un peu plus chaque mois.
export function echeances(
  reference: string,
  regle: Regle,
  depuis: string,
  combien: number,
): string[] {
  if (regle.pas < 1) {
    throw new Error(`un pas de ${regle.pas} n'est pas une récurrence : le calcul ne finirait pas`);
  }

  const avancer = (k: number): string => {
    switch (regle.unite) {
      case "day": return ajouterJours(reference, k * regle.pas);
      case "week": return ajouterJours(reference, k * regle.pas * 7);
      case "month": return ajouterMois(reference, k * regle.pas);
      case "quarter": return ajouterMois(reference, k * regle.pas * 3);
      case "year": return ajouterMois(reference, k * regle.pas * 12);
    }
  };

  // On saute d'abord les échéances passées, sans les fabriquer une à une : le
  // premier k utile s'approche, puis on ajuste. Une référence ancienne — une
  // date de naissance de 1950 — ne doit pas coûter mille itérations.
  const jjDepuis = versJourJulien(...decomposer(depuis));
  const jjRef = versJourJulien(...decomposer(reference));
  const parPas = { day: 1, week: 7, month: 30.44, quarter: 91.3, year: 365.25 }[regle.unite];
  let k = Math.max(0, Math.floor((jjDepuis - jjRef) / (parPas * regle.pas)) - 1);
  while (avancer(k) < depuis) k++;

  const rendues: string[] = [];
  for (let i = 0; i < combien; i++) rendues.push(avancer(k + i));
  return rendues;
}

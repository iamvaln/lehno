import { Inject, Injectable } from "@nestjs/common";
import type { CreatePersonInput, Person, UpdatePersonInput } from "@lehno/contracts";
import { TenantRepository } from "../tenancy/tenant.repository.js";

// L'annuaire et la fiche. Toutes les lectures passent par la portée cloisonnée
// du dépôt : une requête Prisma directe sur `person` ici serait un défaut, le
// cloisonnement cesserait d'être garanti par construction.
@Injectable()
export class PersonService {
  // @Inject explicite : voir ProfileService, même contrainte esbuild/vitest.
  constructor(@Inject(TenantRepository) private readonly depot: TenantRepository) {}

  async list(userId: string): Promise<Person[]> {
    const lignes = await this.depot.persons(userId).findMany({});
    return lignes.map(rendre);
  }

  async create(userId: string, input: CreatePersonInput): Promise<Person> {
    // Les champs s'ÉNUMÈRENT au lieu de s'étaler : une clé inattendue — un
    // userId glissé par un appelant qui contourne le typage — n'atteint jamais
    // le dépôt. C'est la première des deux gardes du cloisonnement à
    // l'écriture, la seconde étant l'ordre d'écriture de Scope.create.
    //
    // Le prix de cette énumération : un champ ajouté au contrat et oublié ici
    // ne serait jamais écrit, en silence. C'est ce que garde le test
    // « écrit tous les champs du contrat » de person.test.ts.
    const ligne = await this.depot.persons(userId).create({
      displayName: input.displayName,
      callingName: input.callingName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      relation: input.relation ?? null,
      register: input.register ?? null,
      language: input.language ?? null,
      relationHint: input.relationHint ?? null,
      birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00Z`) : null,
      birthYearKnown: input.birthYearKnown ?? true,
      city: input.city ?? null,
      gender: input.gender ?? null,
      country: input.country ?? null,
      preferredChannel: input.preferredChannel ?? null,
    });
    return rendre(ligne);
  }

  async get(userId: string, id: string): Promise<Person> {
    return rendre(await this.depot.persons(userId).findOrThrow(id));
  }

  async update(userId: string, id: string, input: UpdatePersonInput): Promise<Person> {
    // updateOrThrow refuse les colonnes d'appartenance dans les données et rend
    // un not_found si la ressource n'est pas au demandeur — les deux
    // protections viennent du dépôt, pas d'un contrôle ici.
    return rendre(await this.depot.persons(userId).updateOrThrow(id, input as never));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.depot.persons(userId).deleteOrThrow(id);
  }
}

// La date se rend en chaîne ISO : le contrat est du JSON, pas un objet Date.
function rendre(p: {
  id: string; displayName: string; callingName: string | null; avatarUrl: string | null;
  isSelf: boolean; relation: string | null; register: string | null; language: string | null;
  relationHint: string | null; birthDate: Date | null; birthYearKnown: boolean;
  gender: string | null; city: string | null;
  country: string | null; preferredChannel: string | null; createdAt: Date;
}): Person {
  return {
    id: p.id,
    displayName: p.displayName,
    callingName: p.callingName,
    avatarUrl: p.avatarUrl,
    isSelf: p.isSelf,
    relation: p.relation as Person["relation"],
    relationHint: p.relationHint,
    // La date de naissance se rend en chaîne civile, comme toutes les dates
    // du contrat : du JSON, pas un objet Date.
    birthDate: p.birthDate ? p.birthDate.toISOString().slice(0, 10) : null,
    birthYearKnown: p.birthYearKnown,
    gender: p.gender as Person["gender"],
    city: p.city,
    country: p.country,
    register: p.register as Person["register"],
    language: p.language,
    preferredChannel: p.preferredChannel as Person["preferredChannel"],
    createdAt: p.createdAt.toISOString(),
  };
}

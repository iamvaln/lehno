import { Inject, Injectable } from "@nestjs/common";
import type { CreatePersonInput, Person } from "@lehno/contracts";
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
    const ligne = await this.depot.persons(userId).create({
      displayName: input.displayName,
      register: input.register ?? null,
      language: input.language ?? null,
      relationHint: input.relationHint ?? null,
    });
    return rendre(ligne);
  }
}

// La date se rend en chaîne ISO : le contrat est du JSON, pas un objet Date.
function rendre(p: {
  id: string; displayName: string; isSelf: boolean;
  register: string | null; language: string | null; relationHint: string | null;
  createdAt: Date;
}): Person {
  return {
    id: p.id,
    displayName: p.displayName,
    isSelf: p.isSelf,
    register: p.register as Person["register"],
    language: p.language,
    relationHint: p.relationHint,
    createdAt: p.createdAt.toISOString(),
  };
}

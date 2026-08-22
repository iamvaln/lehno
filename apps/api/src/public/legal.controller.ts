import { Controller, Get, Header, Inject, Injectable, Param, Query } from "@nestjs/common";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LEGAL_DOCUMENTS, LEGAL_LANGUAGES, type LegalDocument, type LegalLanguage } from "@lehno/contracts";
import { AppError } from "../common/errors.js";

const LEGAL_DIR = join(dirname(fileURLToPath(import.meta.url)), "legal");

function isLegalDocument(value: string): value is LegalDocument {
  return (LEGAL_DOCUMENTS as readonly string[]).includes(value);
}

function isLegalLanguage(value: string): value is LegalLanguage {
  return (LEGAL_LANGUAGES as readonly string[]).includes(value);
}

@Injectable()
export class LegalService {
  // Un nom de document ou de langue venu de la requête ne construit jamais
  // un chemin : on refuse tout ce qui n'appartient pas aux deux listes
  // fermées ci-dessus, plutôt que d'assainir l'entrée. Une fois ce contrôle
  // passé, `document` et `language` valent l'un des littéraux connus — le
  // nom de fichier qui en découle ne peut pas s'échapper de LEGAL_DIR.
  async read(document: string, language: string): Promise<string> {
    if (!isLegalDocument(document) || !isLegalLanguage(language))
      throw new AppError("not_found", "unknown legal document or language");
    try {
      return await readFile(join(LEGAL_DIR, `${document}.${language}.md`), "utf-8");
    } catch {
      throw new AppError("not_found", "legal document file missing");
    }
  }
}

@Controller("public/legal")
export class LegalController {
  constructor(@Inject(LegalService) private readonly legal: LegalService) {}

  // Le français est la langue de référence (voir contraintes globales) :
  // `lang` par défaut vaut "fr" quand la requête ne le précise pas.
  @Get(":document")
  @Header("Content-Type", "text/markdown; charset=utf-8")
  get(@Param("document") document: string, @Query("lang") lang = "fr"): Promise<string> {
    return this.legal.read(document, lang);
  }
}

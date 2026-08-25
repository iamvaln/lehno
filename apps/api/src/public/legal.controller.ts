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

  // La version d'un document, lue dans son en-tête — « _Version 2026-08-23 · … ».
  //
  // Elle se lit DANS le document servi, jamais dans une constante posée à côté.
  // Une constante finirait par mentir le jour où quelqu'un met à jour les
  // conditions sans y penser : on enregistrerait alors des acceptations de la
  // mauvaise version, et rien ne rougirait — la trace juridique serait fausse
  // sans qu'aucune chaîne ne le dise.
  //
  // Un document sans version reconnaissable fait ÉCHOUER l'appel plutôt que de
  // rendre une valeur de repli : mieux vaut refuser de créer un compte que
  // d'enregistrer une acceptation dont on ne sait pas de quoi elle parle.
  async version(document: string, language: string): Promise<string> {
    const texte = await this.read(document, language);
    const trouve = /^_Version\s+(\S+)/m.exec(texte);
    if (!trouve?.[1])
      throw new AppError(
        "internal_error",
        `le document légal ${document}.${language} ne porte pas de ligne « _Version … »`,
      );
    return trouve[1];
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

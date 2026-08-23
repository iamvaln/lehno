// Doit rester le premier import : il pose les variables d'environnement avant
// que le moindre module ne les lise (voir env.ts).
import "./env.js";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { AppExceptionFilter } from "./common/errors.js";

async function bootstrap(): Promise<void> {
  // abortOnError: false — sans ça, une erreur d'initialisation (secret manquant,
  // dépendance non résolue) fait appeler process.abort() par Nest : un crash
  // natif sans message clair. On préfère rejeter la promesse et l'écrire
  // nous-mêmes, pour que l'échec au démarrage reste lisible dans les journaux.
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  app.setGlobalPrefix("v1");
  app.useGlobalFilters(new AppExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});

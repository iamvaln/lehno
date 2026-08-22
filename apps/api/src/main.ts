import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { AppExceptionFilter } from "./common/errors.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("v1");
  app.useGlobalFilters(new AppExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000));
}
void bootstrap();

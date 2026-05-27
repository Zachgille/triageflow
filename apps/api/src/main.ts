import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { AppConfigService } from './runtime-config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  const config = app.get(AppConfigService);
  const port = config.values.PORT;

  await app.listen(port, '0.0.0.0');
}

void bootstrap();

import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { carregarArquivoEnv, carregarEnv } from './config/env.js';
import { configurarApp } from './configurar-app.js';

const NIVEIS = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'] as const;

async function iniciar(): Promise<void> {
  carregarArquivoEnv();
  const env = carregarEnv();

  const logger = new ConsoleLogger({
    json: env.NODE_ENV === 'production',
    logLevels: NIVEIS.slice(0, NIVEIS.indexOf(env.LOG_LEVEL) + 1),
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger });
  configurarApp(app, env);
  await app.listen(env.PORT);
  logger.log(`API ouvindo na porta ${env.PORT}`, 'Inicio');
}

await iniciar();

import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { Env } from './config/env.js';

export const PREFIXO_API = 'api/v1';

/** Configuração HTTP compartilhada entre main.ts e os testes e2e. */
export function configurarApp(app: INestApplication, env: Env): void {
  const express = app as NestExpressApplication;
  express.setGlobalPrefix(PREFIXO_API);
  express.use(helmet());
  express.enableCors({ origin: env.CORS_ORIGENS, credentials: true });
  express.set('trust proxy', 1);
  express.enableShutdownHooks();
}

import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Env } from './config/env.js';
import { AdaptadorTempoReal } from './modulos/tempo-real/adaptador.js';

export const PREFIXO_API = 'api/v1';

/** Configuração HTTP compartilhada entre main.ts e os testes e2e. */
export function configurarApp(app: INestApplication, env: Env): void {
  const express = app as NestExpressApplication;
  express.setGlobalPrefix(PREFIXO_API);
  express.use(helmet());
  express.use(cookieParser());
  express.enableCors({ origin: env.CORS_ORIGENS, credentials: true });
  express.useWebSocketAdapter(new AdaptadorTempoReal(app, env.CORS_ORIGENS));
  express.set('trust proxy', 1);
  express.enableShutdownHooks();
}

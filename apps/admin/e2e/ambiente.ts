import os from 'node:os';
import path from 'node:path';

// Ambiente dos testes E2E do painel: API e painel próprios (portas 4100 e 3100), no banco de teste.
// Assim os testes não mexem nos servidores de desenvolvimento (4000 e 3000) nem no banco de dev.

export const RAIZ = path.resolve(__dirname, '..', '..', '..');

// Local: o mesmo banco dos testes de integração da API (apps/api/.env.test). No CI vem do job.
try {
  process.loadEnvFile(path.join(RAIZ, 'apps', 'api', '.env.test'));
} catch {
  // Sem arquivo: usa as variáveis do ambiente.
}

export const PORTA_API = 4100;
export const PORTA_PAINEL = 3100;
export const URL_API = `http://localhost:${PORTA_API}/api/v1`;
export const URL_PAINEL = `http://localhost:${PORTA_PAINEL}`;

const banco = process.env['DATABASE_URL'];
if (!banco) {
  throw new Error('Defina DATABASE_URL do banco de teste (apps/api/.env.test) para rodar os testes do painel.');
}

export const ambienteApi: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: String(PORTA_API),
  DATABASE_URL: banco,
  DIRECT_DATABASE_URL: process.env['DIRECT_DATABASE_URL'] ?? banco,
  CORS_ORIGENS: URL_PAINEL,
  JWT_SECRET: process.env['JWT_SECRET'] ?? 'segredo-de-teste-local-com-pelo-menos-32-caracteres',
  LIMITE_LOGIN_POR_MINUTO: '1000',
  LOG_LEVEL: 'error',
  // Fotos de comprovante dos testes fora do repositório.
  ARMAZENAMENTO_PASTA: path.join(os.tmpdir(), 'rotas-painel-e2e-arquivos'),
};

/** Administrador criado pelo seed antes dos testes (só existe no banco de teste). */
export const ADMIN_E2E = { email: 'admin.painel@rotas.test', senha: 'PainelE2e#Teste2026' } as const;

import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile();
} catch {
  // Sem .env: usa as variáveis já definidas no ambiente (CI, Render).
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // A CLI (migrations) usa a conexão direta; a aplicação usa DATABASE_URL (com pooling no Neon).
    url: process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? '',
  },
});

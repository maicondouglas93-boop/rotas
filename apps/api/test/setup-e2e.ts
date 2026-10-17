// Carrega .env.test e impede testes destrutivos fora de banco local ou de CI (testing-quality).
try {
  process.loadEnvFile('.env.test');
} catch {
  // No CI as variáveis vêm do ambiente do job.
}

process.env['JWT_SECRET'] ??= 'segredo-de-teste-local-com-pelo-menos-32-caracteres';
process.env['LIMITE_LOGIN_POR_MINUTO'] ??= '1000';
// Fotos de comprovante dos testes ficam numa pasta temporária, fora do repositório.
process.env['ARMAZENAMENTO_PASTA'] ??= `${process.env['TMPDIR'] ?? process.env['TEMP'] ?? '/tmp'}/rotas-e2e-arquivos`;

const url = process.env['DATABASE_URL'] ?? '';
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
})();

const permitido = ['localhost', '127.0.0.1', 'postgres'].includes(host);
if (!permitido) {
  throw new Error(
    `Testes e2e recusados: DATABASE_URL aponta para "${host || 'valor inválido'}". Use o banco local de teste (apps/api/.env.test).`,
  );
}

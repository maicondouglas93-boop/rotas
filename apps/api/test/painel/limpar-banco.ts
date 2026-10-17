// Zera o banco usado pelos testes E2E do painel (Playwright). Recusa banco que não seja local e de teste.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';

const url = process.env['DATABASE_URL'] ?? '';
const destino = (() => {
  try {
    const u = new URL(url);
    return { host: u.hostname, banco: u.pathname.slice(1) };
  } catch {
    return { host: '', banco: '' };
  }
})();

if (!['localhost', '127.0.0.1', 'postgres'].includes(destino.host) || !destino.banco.includes('test')) {
  throw new Error(
    `Limpeza recusada: DATABASE_URL aponta para "${destino.host}/${destino.banco}". Use um banco local de teste (ex.: rotas_test).`,
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  await prisma.$executeRaw`
    TRUNCATE
      usuarios,
      motoristas,
      sessoes_refresh,
      comandos_processados,
      empresas,
      rotas,
      paradas,
      servicos,
      ocorrencias,
      rota_eventos
    RESTART IDENTITY CASCADE
  `;
  console.info(`Banco ${destino.banco} limpo para os testes do painel.`);
} finally {
  await prisma.$disconnect();
}

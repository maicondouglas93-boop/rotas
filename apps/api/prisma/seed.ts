import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { carregarArquivoEnv } from '../src/config/env.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { SenhasService } from '../src/modulos/auth/senhas.service.js';

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

async function executarSeed(): Promise<void> {
  carregarArquivoEnv();

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Execução do seed recusada: NODE_ENV=production não é permitido.');
  }

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('Variável obrigatória ausente para o seed: DATABASE_URL.');
  }

  const emailBruto = process.env['SEED_ADMIN_EMAIL'];
  const senhaAdmin = process.env['SEED_ADMIN_SENHA'];
  const faltantes: string[] = [];
  if (!emailBruto || emailBruto.trim() === '') faltantes.push('SEED_ADMIN_EMAIL');
  if (!senhaAdmin || senhaAdmin === '') faltantes.push('SEED_ADMIN_SENHA');

  if (faltantes.length > 0) {
    throw new Error(
      `Defina as variáveis obrigatórias antes de rodar o seed: ${faltantes.join(', ')}.`,
    );
  }

  const emailValidado = emailSchema.safeParse(emailBruto);
  if (!emailValidado.success) {
    throw new Error('SEED_ADMIN_EMAIL possui formato de e-mail inválido.');
  }
  const email = emailValidado.data;

  const senhas = new SenhasService();
  senhas.validarPoliticaNovaSenha(senhaAdmin as string, email);
  const senhaHash = await senhas.gerarHash(senhaAdmin as string);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const admin = await prisma.usuario.upsert({
      where: { email },
      update: {
        senhaHash,
        perfil: 'ADMIN',
        ativo: true,
        deveTrocarSenha: false,
      },
      create: {
        email,
        senhaHash,
        perfil: 'ADMIN',
        ativo: true,
        deveTrocarSenha: false,
      },
      select: {
        id: true,
        email: true,
        perfil: true,
      },
    });

    console.info(`Seed concluído: administrador ${admin.email} (${admin.id}) pronto.`);
  } finally {
    await prisma.$disconnect();
  }
}

await executarSeed();

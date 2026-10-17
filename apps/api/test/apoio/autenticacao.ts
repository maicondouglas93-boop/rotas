import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { sessaoSchema, type ClienteAuth, type Sessao } from '@rotas/shared';
import { argon2id, hash } from 'argon2';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';

export const SENHA_PADRAO_TESTE = 'SenhaForteTeste123!';

let hashSenhaPadraoPromessa: Promise<string> | undefined;

async function obterHashSenha(senha: string): Promise<string> {
  if (senha === SENHA_PADRAO_TESTE) {
    hashSenhaPadraoPromessa ??= hash(SENHA_PADRAO_TESTE, { type: argon2id });
    return hashSenhaPadraoPromessa;
  }
  return hash(senha, { type: argon2id });
}

export async function limparBancoTeste(prisma: PrismaService): Promise<void> {
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
}

export interface OpcoesCriarAdminTeste {
  email?: string;
  senha?: string;
  ativo?: boolean;
  deveTrocarSenha?: boolean;
}

export async function criarAdminTeste(
  prisma: PrismaService,
  opcoes: OpcoesCriarAdminTeste = {},
) {
  const email = (opcoes.email ?? `admin-${randomUUID()}@rotas.test`).trim().toLowerCase();
  const senha = opcoes.senha ?? SENHA_PADRAO_TESTE;
  const senhaHash = await obterHashSenha(senha);

  const usuario = await prisma.usuario.create({
    data: {
      email,
      senhaHash,
      perfil: 'ADMIN',
      ativo: opcoes.ativo ?? true,
      deveTrocarSenha: opcoes.deveTrocarSenha ?? false,
    },
  });

  return { usuario, email, senha };
}

export interface OpcoesCriarMotoristaTeste {
  email?: string;
  senha?: string;
  nome?: string;
  telefone?: string;
  ativo?: boolean;
  deveTrocarSenha?: boolean;
}

export async function criarMotoristaTeste(
  prisma: PrismaService,
  opcoes: OpcoesCriarMotoristaTeste = {},
) {
  const email = (opcoes.email ?? `motorista-${randomUUID()}@rotas.test`).trim().toLowerCase();
  const senha = opcoes.senha ?? SENHA_PADRAO_TESTE;
  const nome = opcoes.nome ?? 'Motorista de Teste';
  const telefone = opcoes.telefone ?? '+5511988887777';
  const ativo = opcoes.ativo ?? true;
  const senhaHash = await obterHashSenha(senha);

  const usuario = await prisma.usuario.create({
    data: {
      email,
      senhaHash,
      perfil: 'MOTORISTA',
      ativo,
      deveTrocarSenha: opcoes.deveTrocarSenha ?? false,
      motorista: {
        create: {
          nome,
          telefone,
          desativadoEm: ativo ? null : new Date(),
        },
      },
    },
    include: {
      motorista: true,
    },
  });

  return {
    usuario,
    motorista: usuario.motorista!,
    email,
    senha,
  };
}

export async function fazerLoginTeste(
  app: INestApplication<App>,
  credenciais: { email: string; senha?: string; cliente?: ClienteAuth },
): Promise<{
  sessao: Sessao;
  accessToken: string;
  refreshToken: string | undefined;
  setCookie: string[];
}> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({
      email: credenciais.email,
      senha: credenciais.senha ?? SENHA_PADRAO_TESTE,
      cliente: credenciais.cliente ?? 'app',
    })
    .expect(200);

  const sessao = sessaoSchema.parse(res.body);
  const cabecalhoCookie = res.headers['set-cookie'];
  const setCookie = Array.isArray(cabecalhoCookie)
    ? cabecalhoCookie
    : cabecalhoCookie
      ? [cabecalhoCookie]
      : [];

  return {
    sessao,
    accessToken: sessao.accessToken,
    refreshToken: sessao.refreshToken,
    setCookie,
  };
}

export async function autenticarAdminTeste(
  app: INestApplication<App>,
  prisma: PrismaService,
  opcoes: OpcoesCriarAdminTeste = {},
) {
  const criado = await criarAdminTeste(prisma, opcoes);
  const login = await fazerLoginTeste(app, {
    email: criado.email,
    senha: criado.senha,
    cliente: 'app',
  });
  return { ...criado, ...login };
}

export async function autenticarMotoristaTeste(
  app: INestApplication<App>,
  prisma: PrismaService,
  opcoes: OpcoesCriarMotoristaTeste = {},
) {
  const criado = await criarMotoristaTeste(prisma, opcoes);
  const login = await fazerLoginTeste(app, {
    email: criado.email,
    senha: criado.senha,
    cliente: 'app',
  });
  return { ...criado, ...login };
}

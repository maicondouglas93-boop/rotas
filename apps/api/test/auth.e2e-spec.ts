import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { respostaErroSchema, sessaoSchema, usuarioSessaoSchema } from '@rotas/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { carregarEnv, ENV, type Env } from '../src/config/env.js';
import { configurarApp } from '../src/configurar-app.js';
import { CHAVE_PERFIS, CHAVE_PUBLICO } from '../src/modulos/auth/decoradores.js';
import { NOME_COOKIE_REFRESH } from '../src/modulos/auth/tipos.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  autenticarAdminTeste,
  autenticarMotoristaTeste,
  criarAdminTeste,
  criarMotoristaTeste,
  fazerLoginTeste,
  limparBancoTeste,
  SENHA_PADRAO_TESTE,
} from './apoio/autenticacao.js';

function extrairCookieRefresh(setCookieHeader: string | string[] | undefined): string {
  const lista = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const encontrado = lista.find((c) => c.startsWith(`${NOME_COOKIE_REFRESH}=`));
  if (!encontrado) {
    throw new Error(`Cookie ${NOME_COOKIE_REFRESH} não encontrado no cabeçalho Set-Cookie.`);
  }
  return encontrado;
}

describe('Autenticação e autorização (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurarApp(app, carregarEnv());
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limparBancoTeste(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/login (painel) grava cookie HttpOnly/SameSite=Lax/Path=/api/v1/auth e omite refreshToken do corpo', async () => {
    const { email, senha, usuario } = await criarAdminTeste(prisma);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('User-Agent', 'Mozilla/5.0 Painel Teste')
      .send({ email: `  ${email.toUpperCase()}  `, senha, cliente: 'painel' })
      .expect(200);

    const sessao = sessaoSchema.parse(res.body);
    expect(sessao.refreshToken).toBeUndefined();
    expect(res.body).not.toHaveProperty('refreshToken');
    expect(sessao.usuario).toEqual({
      id: usuario.id,
      email,
      perfil: 'ADMIN',
      nome: null,
      deveTrocarSenha: false,
    });

    const cookie = extrairCookieRefresh(res.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/v1/auth');

    const gravada = await prisma.sessaoRefresh.findFirst({ where: { usuarioId: usuario.id } });
    expect(gravada).not.toBeNull();
    expect(gravada?.userAgent).toBe('Mozilla/5.0 Painel Teste');
    expect(gravada?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('POST /api/v1/auth/login (app) devolve refreshToken no corpo e não grava cookie', async () => {
    const { email, senha, usuario, motorista } = await criarMotoristaTeste(prisma, {
      nome: 'Carlos Entregador',
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, senha, cliente: 'app' })
      .expect(200);

    const sessao = sessaoSchema.parse(res.body);
    expect(sessao.refreshToken).toEqual(expect.any(String));
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(sessao.usuario).toEqual({
      id: usuario.id,
      email,
      perfil: 'MOTORISTA',
      nome: motorista.nome,
      deveTrocarSenha: false,
    });
  });

  it('POST /api/v1/auth/login retorna 401 com a mesma mensagem para senha errada e e-mail inexistente', async () => {
    const { email } = await criarAdminTeste(prisma);

    const resSenhaErrada = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, senha: 'SenhaIncorreta999!', cliente: 'painel' })
      .expect(401);

    const resEmailInexistente = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'inexistente@rotas.test', senha: 'SenhaIncorreta999!', cliente: 'painel' })
      .expect(401);

    const erroSenha = respostaErroSchema.parse(resSenhaErrada.body).erro;
    const erroEmail = respostaErroSchema.parse(resEmailInexistente.body).erro;

    expect(erroSenha.codigo).toBe('NAO_AUTENTICADO');
    expect(erroEmail.codigo).toBe('NAO_AUTENTICADO');
    expect(erroSenha.mensagem).toBe('E-mail ou senha inválidos.');
    expect(erroEmail.mensagem).toBe(erroSenha.mensagem);
  });

  it('POST /api/v1/auth/login retorna 401 para usuário inativo com a mesma mensagem padrão', async () => {
    const { email, senha } = await criarAdminTeste(prisma, { ativo: false });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, senha, cliente: 'app' })
      .expect(401);

    const erro = respostaErroSchema.parse(res.body).erro;
    expect(erro.codigo).toBe('NAO_AUTENTICADO');
    expect(erro.mensagem).toBe('E-mail ou senha inválidos.');
  });

  it('POST /api/v1/auth/refresh (app) rotaciona o refresh token na mesma família e grava substituidaPorId', async () => {
    const { refreshToken: tokenInicial, usuario } = await autenticarAdminTeste(app, prisma);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokenInicial })
      .expect(200);

    const novaSessao = sessaoSchema.parse(res.body);
    expect(novaSessao.refreshToken).toEqual(expect.any(String));
    expect(novaSessao.refreshToken).not.toBe(tokenInicial);

    const sessoes = await prisma.sessaoRefresh.findMany({
      where: { usuarioId: usuario.id },
      orderBy: { criadoEm: 'asc' },
    });
    expect(sessoes).toHaveLength(2);
    expect(sessoes[0]?.familiaId).toBe(sessoes[1]?.familiaId);
    expect(sessoes[0]?.revogadaEm).toBeInstanceOf(Date);
    expect(sessoes[0]?.substituidaPorId).toBe(sessoes[1]?.id);
    expect(sessoes[1]?.revogadaEm).toBeNull();
  });

  it('POST /api/v1/auth/refresh (app) detecta reuso do token antigo, retorna 401 e invalida o token novo da mesma família', async () => {
    const { refreshToken: tokenAntigo } = await autenticarAdminTeste(app, prisma);

    const resRotacao = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokenAntigo })
      .expect(200);
    const sessaoNova = sessaoSchema.parse(resRotacao.body);

    const resReuso = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokenAntigo })
      .expect(401);
    expect(respostaErroSchema.parse(resReuso.body).erro.codigo).toBe('NAO_AUTENTICADO');

    const resTokenNovoDaFamilia = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: sessaoNova.refreshToken })
      .expect(401);
    expect(respostaErroSchema.parse(resTokenNovoDaFamilia.body).erro.codigo).toBe(
      'NAO_AUTENTICADO',
    );

    await request(app.getHttpServer())
      .get('/api/v1/auth/eu')
      .set('Authorization', `Bearer ${sessaoNova.accessToken}`)
      .expect(401);
  });

  it('POST /api/v1/auth/refresh (painel) com Origin permitida retorna 200 e emite cookie novo', async () => {
    const { email, senha } = await criarAdminTeste(prisma);
    const login = await fazerLoginTeste(app, { email, senha, cliente: 'painel' });
    const cookieInicial = extrairCookieRefresh(login.setCookie);
    const parCookieInicial = cookieInicial.split(';')[0]!;

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', parCookieInicial)
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    const sessao = sessaoSchema.parse(res.body);
    expect(sessao.refreshToken).toBeUndefined();

    const cookieNovo = extrairCookieRefresh(res.headers['set-cookie']);
    expect(cookieNovo.split(';')[0]).not.toBe(parCookieInicial);
  });

  it('POST /api/v1/auth/refresh (painel) sem cabeçalho Origin ou com Origin não autorizada retorna 403 SEM_PERMISSAO', async () => {
    const { email, senha } = await criarAdminTeste(prisma);
    const login = await fazerLoginTeste(app, { email, senha, cliente: 'painel' });
    const parCookie = extrairCookieRefresh(login.setCookie).split(';')[0]!;

    const resSemOrigin = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', parCookie)
      .expect(403);
    expect(respostaErroSchema.parse(resSemOrigin.body).erro.codigo).toBe('SEM_PERMISSAO');

    const resOriginInvalida = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', parCookie)
      .set('Origin', 'https://atacante.exemplo.com')
      .expect(403);
    expect(respostaErroSchema.parse(resOriginInvalida.body).erro.codigo).toBe('SEM_PERMISSAO');
  });

  it('POST /api/v1/auth/logout revoga a família e invalida imediatamente o refresh token e o access token', async () => {
    const { accessToken, refreshToken } = await autenticarAdminTeste(app, prisma);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/auth/eu')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('rota protegida sem token retorna 401 NAO_AUTENTICADO', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/empresas').expect(401);
    expect(respostaErroSchema.parse(res.body).erro.codigo).toBe('NAO_AUTENTICADO');
  });

  it('rota protegida com token malformado retorna 401 NAO_AUTENTICADO', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/empresas')
      .set('Authorization', 'Bearer token-invalido-qualquer')
      .expect(401);
    expect(respostaErroSchema.parse(res.body).erro.codigo).toBe('NAO_AUTENTICADO');
  });

  it('rota protegida com token assinado com outra chave retorna 401 NAO_AUTENTICADO', async () => {
    const { usuario } = await autenticarAdminTeste(app, prisma);
    const jwt = new JwtService();
    const tokenFalso = await jwt.signAsync(
      { sub: usuario.id, perfil: 'ADMIN', sid: randomUUID() },
      {
        algorithm: 'HS256',
        secret: 'chave-diferente-da-configurada-com-mais-de-32-chars',
        expiresIn: 900,
      },
    );

    const res = await request(app.getHttpServer())
      .get('/api/v1/empresas')
      .set('Authorization', `Bearer ${tokenFalso}`)
      .expect(401);
    expect(respostaErroSchema.parse(res.body).erro.codigo).toBe('NAO_AUTENTICADO');
  });

  it('motorista autenticado tentando acessar /api/v1/empresas recebe 403 SEM_PERMISSAO', async () => {
    const { accessToken } = await autenticarMotoristaTeste(app, prisma);

    const res = await request(app.getHttpServer())
      .get('/api/v1/empresas')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
    expect(respostaErroSchema.parse(res.body).erro.codigo).toBe('SEM_PERMISSAO');
  });

  it('usuário com senha temporária recebe 403 TROCA_SENHA_OBRIGATORIA em /empresas, mas 200 em /auth/eu sem cabeçalhos de rate limit', async () => {
    const { accessToken, usuario, email } = await autenticarAdminTeste(app, prisma, {
      deveTrocarSenha: true,
    });

    const resEmpresas = await request(app.getHttpServer())
      .get('/api/v1/empresas')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
    const erro = respostaErroSchema.parse(resEmpresas.body).erro;
    expect(erro.codigo).toBe('TROCA_SENHA_OBRIGATORIA');
    expect(erro.mensagem).toBe('Troque sua senha para continuar.');

    const resEu = await request(app.getHttpServer())
      .get('/api/v1/auth/eu')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(resEu.headers['x-ratelimit-limit']).toBeUndefined();
    expect(usuarioSessaoSchema.parse(resEu.body)).toEqual({
      id: usuario.id,
      email,
      perfil: 'ADMIN',
      nome: null,
      deveTrocarSenha: true,
    });
  });

  it('POST /api/v1/auth/trocar-senha retorna 422 REGRA_NEGOCIO quando a senhaAtual está incorreta', async () => {
    const { accessToken } = await autenticarAdminTeste(app, prisma, {
      deveTrocarSenha: true,
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/trocar-senha')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        senhaAtual: 'SenhaAtualErrada999!',
        novaSenha: 'NovaSenhaSuperSegura2026!',
      })
      .expect(422);

    const erro = respostaErroSchema.parse(res.body).erro;
    expect(erro.codigo).toBe('REGRA_NEGOCIO');
    expect(erro.mensagem).toBe('Senha atual incorreta.');
  });

  it('POST /api/v1/auth/trocar-senha retorna 422 REGRA_NEGOCIO quando a nova senha viola a política', async () => {
    const { accessToken } = await autenticarAdminTeste(app, prisma, {
      deveTrocarSenha: true,
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/trocar-senha')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        senhaAtual: SENHA_PADRAO_TESTE,
        novaSenha: 'password',
      })
      .expect(422);

    expect(respostaErroSchema.parse(res.body).erro.codigo).toBe('REGRA_NEGOCIO');
  });

  it('POST /api/v1/auth/trocar-senha libera o acesso a /empresas na sessão atual e derruba as outras sessões do usuário', async () => {
    const admin = await criarAdminTeste(prisma, { deveTrocarSenha: true });
    const sessao1 = await fazerLoginTeste(app, {
      email: admin.email,
      senha: admin.senha,
      cliente: 'app',
    });
    const sessao2 = await fazerLoginTeste(app, {
      email: admin.email,
      senha: admin.senha,
      cliente: 'app',
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/trocar-senha')
      .set('Authorization', `Bearer ${sessao1.accessToken}`)
      .send({
        senhaAtual: admin.senha,
        novaSenha: 'NovaSenhaSuperSegura2026!',
      })
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/empresas')
      .set('Authorization', `Bearer ${sessao1.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/auth/eu')
      .set('Authorization', `Bearer ${sessao2.accessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: sessao2.refreshToken })
      .expect(401);
  });

  it('POST /api/v1/auth/login com LIMITE_LOGIN_POR_MINUTO=3 permite 4 e-mails diferentes do mesmo IP sem 429', async () => {
    const envRestrito: Env = {
      ...carregarEnv(),
      LIMITE_LOGIN_POR_MINUTO: 3,
    };

    const moduloRestrito = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(envRestrito)
      .compile();

    const appRestrito = moduloRestrito.createNestApplication();
    configurarApp(appRestrito, envRestrito);
    await appRestrito.init();

    try {
      for (let i = 1; i <= 4; i++) {
        await request(appRestrito.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: `motorista${i}@rotas.test`,
            senha: 'qualquer-senha',
            cliente: 'app',
          })
          .expect(401);
      }
    } finally {
      await appRestrito.close();
    }
  });

  it('POST /api/v1/auth/login com LIMITE_LOGIN_POR_MINUTO=3 retorna 429 MUITAS_TENTATIVAS na 4ª tentativa para o mesmo IP + e-mail normalizado', async () => {
    const envRestrito: Env = {
      ...carregarEnv(),
      LIMITE_LOGIN_POR_MINUTO: 3,
    };

    const moduloRestrito = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(envRestrito)
      .compile();

    const appRestrito = moduloRestrito.createNestApplication();
    configurarApp(appRestrito, envRestrito);
    await appRestrito.init();

    try {
      const variantesEmail = [
        'alvo@rotas.test',
        '  ALVO@rotas.test ',
        'Alvo@Rotas.Test',
      ];
      for (const email of variantesEmail) {
        await request(appRestrito.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email,
            senha: 'qualquer-senha',
            cliente: 'painel',
          })
          .expect(401);
      }

      const quarta = await request(appRestrito.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'alvo@rotas.test',
          senha: 'qualquer-senha',
          cliente: 'painel',
        })
        .expect(429);

      const erro = respostaErroSchema.parse(quarta.body).erro;
      expect(erro.codigo).toBe('MUITAS_TENTATIVAS');
      expect(erro.mensagem).toBe('Muitas tentativas. Aguarde um minuto e tente novamente.');
    } finally {
      await appRestrito.close();
    }
  });

  it('todas as rotas HTTP registradas possuem @Publico() ou @Perfis(...)', () => {
    const discovery = new DiscoveryService(app.get(ModulesContainer));
    const scanner = new MetadataScanner();
    const reflector = app.get(Reflector);

    const rotasSemMetadado: string[] = [];
    let totalRotasVerificadas = 0;

    for (const wrapper of discovery.getControllers()) {
      const instancia = wrapper.instance as Record<string, unknown> | undefined;
      const classe = wrapper.metatype;
      if (!instancia || !classe) continue;

      const prototipo = Object.getPrototypeOf(instancia) as Record<string, unknown>;
      for (const nomeMetodo of scanner.getAllMethodNames(prototipo)) {
        const handler = prototipo[nomeMetodo];
        if (typeof handler !== 'function') continue;

        const ehRotaHttp =
          Reflect.hasMetadata('path', handler) && Reflect.hasMetadata('method', handler);
        if (!ehRotaHttp) continue;

        totalRotasVerificadas++;
        const publico = reflector.getAllAndOverride<boolean>(CHAVE_PUBLICO, [handler, classe]);
        const perfis = reflector.getAllAndOverride<string[] | undefined>(CHAVE_PERFIS, [
          handler,
          classe,
        ]);
        const temPerfis = Array.isArray(perfis) && perfis.length > 0;

        if (!publico && !temPerfis) {
          rotasSemMetadado.push(`${classe.name}.${nomeMetodo}`);
        }
      }
    }

    expect(totalRotasVerificadas).toBeGreaterThan(0);
    expect(rotasSemMetadado).toEqual([]);
  });
});

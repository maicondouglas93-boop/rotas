import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { motoristaCriadoSchema, motoristaSchema, respostaErroSchema, senhaRedefinidaSchema } from '@rotas/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { carregarEnv } from '../src/config/env.js';
import { configurarApp } from '../src/configurar-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  autenticarAdminTeste,
  autenticarMotoristaTeste,
  criarAdminTeste,
  limparBancoTeste,
} from './apoio/autenticacao.js';

const paginaMotoristasSchema = z.object({
  itens: z.array(motoristaSchema),
  total: z.number(),
  pagina: z.number(),
  porPagina: z.number(),
});

const novoMotorista = { nome: '  Marcos Lima ', email: ' Marcos.Lima@Exemplo.com ', telefone: '(11) 98765-4321' };

describe('Motoristas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;

  const api = () => request(app.getHttpServer());
  const comoAdmin = <T extends request.Test>(req: T) => req.set('Authorization', `Bearer ${tokenAdmin}`);

  async function criarPelaApi(dados: Record<string, unknown> = novoMotorista) {
    const res = await comoAdmin(api().post('/api/v1/motoristas')).send(dados).expect(201);
    return { resposta: res, criado: motoristaCriadoSchema.parse(res.body) };
  }

  function login(email: string, senha: string) {
    return api().post('/api/v1/auth/login').send({ email, senha, cliente: 'app' });
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurarApp(app, carregarEnv());
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limparBancoTeste(prisma);
    tokenAdmin = (await autenticarAdminTeste(app, prisma)).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('acesso', () => {
    it('sem token responde 401', async () => {
      await api().get('/api/v1/motoristas').expect(401);
    });

    it('motorista não acessa o cadastro (403)', async () => {
      const motorista = await autenticarMotoristaTeste(app, prisma);
      const res = await api()
        .get('/api/v1/motoristas')
        .set('Authorization', `Bearer ${motorista.accessToken}`)
        .expect(403);
      expect(respostaErroSchema.parse(res.body).erro.codigo).toBe('SEM_PERMISSAO');
    });
  });

  describe('criar', () => {
    it('cria com dados normalizados, senha temporária e sem cache', async () => {
      const { resposta, criado } = await criarPelaApi();
      expect(resposta.headers['cache-control']).toBe('no-store');
      expect(criado.motorista).toMatchObject({
        nome: 'Marcos Lima',
        email: 'marcos.lima@exemplo.com',
        telefone: '+5511987654321',
        ativo: true,
        desativadoEm: null,
        deveTrocarSenha: true,
      });
      expect(criado.senhaTemporaria).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
      expect(JSON.stringify(resposta.body)).not.toContain('senhaHash');
    });

    it('guarda a senha temporária só como hash Argon2id', async () => {
      const { criado } = await criarPelaApi();
      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: criado.motorista.usuarioId } });
      expect(usuario.perfil).toBe('MOTORISTA');
      expect(usuario.senhaHash).toMatch(/^\$argon2id\$/);
      expect(usuario.senhaHash).not.toContain(criado.senhaTemporaria);
    });

    it('primeiro acesso com a senha temporária exige troca de senha', async () => {
      const { criado } = await criarPelaApi();
      const res = await login(criado.motorista.email, criado.senhaTemporaria).expect(200);
      const token = res.body.accessToken as string;
      expect(res.body.usuario).toMatchObject({ perfil: 'MOTORISTA', nome: 'Marcos Lima', deveTrocarSenha: true });
      await api().get('/api/v1/auth/eu').set('Authorization', `Bearer ${token}`).expect(200);
      const bloqueado = await api().get('/api/v1/empresas').set('Authorization', `Bearer ${token}`).expect(403);
      expect(respostaErroSchema.parse(bloqueado.body).erro.codigo).toBe('TROCA_SENHA_OBRIGATORIA');
    });

    it('recusa e-mail já usado por outro usuário (409)', async () => {
      const admin = await criarAdminTeste(prisma, { email: 'ocupado@exemplo.com' });
      const res = await comoAdmin(api().post('/api/v1/motoristas'))
        .send({ ...novoMotorista, email: admin.email.toUpperCase() })
        .expect(409);
      expect(respostaErroSchema.parse(res.body).erro).toMatchObject({
        codigo: 'REGISTRO_DUPLICADO',
        mensagem: 'Já existe um usuário com este e-mail.',
      });
    });

    it('valida campos com detalhes (400)', async () => {
      const res = await comoAdmin(api().post('/api/v1/motoristas'))
        .send({ ...novoMotorista, telefone: '123' })
        .expect(400);
      expect(respostaErroSchema.parse(res.body).erro.detalhes).toContainEqual({
        caminho: 'telefone',
        mensagem: 'Telefone inválido.',
      });
    });

    it('não aceita senha ou perfil vindos do cliente (400)', async () => {
      await comoAdmin(api().post('/api/v1/motoristas')).send({ ...novoMotorista, senha: 'Escolhida123' }).expect(400);
      await comoAdmin(api().post('/api/v1/motoristas')).send({ ...novoMotorista, perfil: 'ADMIN' }).expect(400);
    });
  });

  describe('listar e detalhar', () => {
    it('pagina em ordem de nome e busca por nome ou e-mail', async () => {
      await criarPelaApi({ ...novoMotorista, nome: 'Bruno', email: 'bruno@exemplo.com' });
      await criarPelaApi({ ...novoMotorista, nome: 'Ana', email: 'ana@exemplo.com' });
      await criarPelaApi({ ...novoMotorista, nome: 'Carla', email: 'carla@frota.com' });

      const pagina = paginaMotoristasSchema.parse(
        (await comoAdmin(api().get('/api/v1/motoristas?porPagina=2')).expect(200)).body,
      );
      expect(pagina.total).toBe(3);
      expect(pagina.itens.map((m) => m.nome)).toEqual(['Ana', 'Bruno']);

      const porEmail = paginaMotoristasSchema.parse(
        (await comoAdmin(api().get('/api/v1/motoristas?busca=FROTA')).expect(200)).body,
      );
      expect(porEmail.itens.map((m) => m.nome)).toEqual(['Carla']);
    });

    it('omite desativados por padrão e os inclui quando pedido', async () => {
      const { criado } = await criarPelaApi();
      await comoAdmin(api().post(`/api/v1/motoristas/${criado.motorista.id}/desativar`)).expect(200);

      const padrao = paginaMotoristasSchema.parse((await comoAdmin(api().get('/api/v1/motoristas')).expect(200)).body);
      expect(padrao.total).toBe(0);

      const todos = paginaMotoristasSchema.parse(
        (await comoAdmin(api().get('/api/v1/motoristas?incluirDesativados=true')).expect(200)).body,
      );
      expect(todos.itens[0]).toMatchObject({ id: criado.motorista.id, ativo: false });
    });

    it('detalhe inexistente responde 404 e id inválido 400', async () => {
      const res = await comoAdmin(api().get('/api/v1/motoristas/00000000-0000-4000-8000-000000000000')).expect(404);
      expect(respostaErroSchema.parse(res.body).erro.mensagem).toBe('Motorista não encontrado.');
      await comoAdmin(api().get('/api/v1/motoristas/nao-e-uuid')).expect(400);
    });
  });

  describe('atualizar', () => {
    it('altera nome, telefone e e-mail', async () => {
      const { criado } = await criarPelaApi();
      const res = await comoAdmin(api().patch(`/api/v1/motoristas/${criado.motorista.id}`))
        .send({ nome: 'Marcos A. Lima', telefone: '11 3333-4444', email: 'MARCOS@frota.com' })
        .expect(200);
      expect(motoristaSchema.parse(res.body)).toMatchObject({
        nome: 'Marcos A. Lima',
        telefone: '+551133334444',
        email: 'marcos@frota.com',
      });
    });

    it('recusa e-mail de outro usuário sem alterar os demais campos', async () => {
      const outro = await criarAdminTeste(prisma, { email: 'outro@exemplo.com' });
      const { criado } = await criarPelaApi();
      await comoAdmin(api().patch(`/api/v1/motoristas/${criado.motorista.id}`))
        .send({ nome: 'Nome Novo', email: outro.email })
        .expect(409);
      const atual = motoristaSchema.parse(
        (await comoAdmin(api().get(`/api/v1/motoristas/${criado.motorista.id}`)).expect(200)).body,
      );
      expect(atual.nome).toBe('Marcos Lima');
    });

    it('motorista desativado não pode ser editado (422)', async () => {
      const { criado } = await criarPelaApi();
      await comoAdmin(api().post(`/api/v1/motoristas/${criado.motorista.id}/desativar`)).expect(200);
      const res = await comoAdmin(api().patch(`/api/v1/motoristas/${criado.motorista.id}`))
        .send({ nome: 'Outro Nome' })
        .expect(422);
      expect(respostaErroSchema.parse(res.body).erro.codigo).toBe('REGRA_NEGOCIO');
    });
  });

  describe('desativar e reativar', () => {
    it('desativar corta o acesso na hora: access token, refresh e novo login', async () => {
      const motorista = await autenticarMotoristaTeste(app, prisma);
      const auth = `Bearer ${motorista.accessToken}`;
      await api().get('/api/v1/auth/eu').set('Authorization', auth).expect(200);

      const res = await comoAdmin(api().post(`/api/v1/motoristas/${motorista.motorista.id}/desativar`)).expect(200);
      expect(motoristaSchema.parse(res.body)).toMatchObject({ ativo: false });

      await api().get('/api/v1/auth/eu').set('Authorization', auth).expect(401);
      await api().post('/api/v1/auth/refresh').send({ refreshToken: motorista.refreshToken }).expect(401);
      await login(motorista.email, motorista.senha).expect(401);
    });

    it('desativar duas vezes é idempotente e mantém a data original', async () => {
      const { criado } = await criarPelaApi();
      const caminho = `/api/v1/motoristas/${criado.motorista.id}/desativar`;
      const primeira = motoristaSchema.parse((await comoAdmin(api().post(caminho)).expect(200)).body);
      const segunda = motoristaSchema.parse((await comoAdmin(api().post(caminho)).expect(200)).body);
      expect(segunda.desativadoEm).toBe(primeira.desativadoEm);
    });

    it('reativar devolve o acesso com a senha existente', async () => {
      const motorista = await autenticarMotoristaTeste(app, prisma);
      await comoAdmin(api().post(`/api/v1/motoristas/${motorista.motorista.id}/desativar`)).expect(200);
      const res = await comoAdmin(api().post(`/api/v1/motoristas/${motorista.motorista.id}/reativar`)).expect(200);
      expect(motoristaSchema.parse(res.body)).toMatchObject({ ativo: true, desativadoEm: null });
      await login(motorista.email, motorista.senha).expect(200);
    });
  });

  describe('redefinir senha', () => {
    it('gera nova senha temporária, invalida a antiga e encerra as sessões', async () => {
      const motorista = await autenticarMotoristaTeste(app, prisma);
      const res = await comoAdmin(api().post(`/api/v1/motoristas/${motorista.motorista.id}/redefinir-senha`)).expect(
        200,
      );
      expect(res.headers['cache-control']).toBe('no-store');
      const { senhaTemporaria } = senhaRedefinidaSchema.parse(res.body);

      await api().get('/api/v1/auth/eu').set('Authorization', `Bearer ${motorista.accessToken}`).expect(401);
      await login(motorista.email, motorista.senha).expect(401);
      const novo = await login(motorista.email, senhaTemporaria).expect(200);
      expect(novo.body.usuario.deveTrocarSenha).toBe(true);
    });

    it('não redefine senha de motorista desativado (422)', async () => {
      const { criado } = await criarPelaApi();
      await comoAdmin(api().post(`/api/v1/motoristas/${criado.motorista.id}/desativar`)).expect(200);
      await comoAdmin(api().post(`/api/v1/motoristas/${criado.motorista.id}/redefinir-senha`)).expect(422);
    });
  });
});

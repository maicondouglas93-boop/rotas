import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { painelHojeSchema, rotaSchema, type Rota } from '@rotas/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { carregarEnv } from '../src/config/env.js';
import { configurarApp } from '../src/configurar-app.js';
import { hojeEmSaoPaulo } from '../src/modulos/painel/painel.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { autenticarAdminTeste, autenticarMotoristaTeste, limparBancoTeste } from './apoio/autenticacao.js';

type MotoristaTeste = Awaited<ReturnType<typeof autenticarMotoristaTeste>>;

const DIA = '2026-10-20';

describe('Painel do dia (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;
  let motorista: MotoristaTeste;

  const api = () => request(app.getHttpServer());
  const comoAdmin = <T extends request.Test>(req: T) => req.set('Authorization', `Bearer ${tokenAdmin}`);

  async function comando(caminho: string, corpo: object = {}): Promise<Rota> {
    const res = await api()
      .post(`/api/v1/motorista/${caminho}`)
      .set('Authorization', `Bearer ${motorista.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send(corpo)
      .expect(200);
    return rotaSchema.parse(res.body);
  }

  async function criarRota(nome: string, dataPrevista: string, enviar: boolean): Promise<Rota> {
    const empresas = await Promise.all(
      [1, 2].map((n) =>
        prisma.empresa.create({
          data: {
            nomeFantasia: `${nome} — empresa ${n}`,
            telefone: '+5511987654321',
            logradouro: 'Rua A',
            numero: String(n),
            bairro: 'Centro',
            cidade: 'São Paulo',
            uf: 'SP',
            cep: '01011100',
          },
        }),
      ),
    );
    const criada = rotaSchema.parse(
      (
        await comoAdmin(api().post('/api/v1/rotas'))
          .send({
            nome,
            dataPrevista,
            motoristaId: motorista.motorista.id,
            paradas: empresas.map((e) => ({ empresaId: e.id, servicos: ['ENTREGA'] })),
          })
          .expect(201)
      ).body,
    );
    if (!enviar) return criada;
    return rotaSchema.parse(
      (await comoAdmin(api().post(`/api/v1/rotas/${criada.id}/enviar`)).send({ versao: criada.versao }).expect(200)).body,
    );
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
    motorista = await autenticarMotoristaTeste(app, prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lista só as rotas do dia, com parada atual, ocorrências e última atividade, na ordem do que pede ação', async () => {
    const rascunho = await criarRota('Rota B rascunho', DIA, false);
    const emAndamento = await criarRota('Rota A em andamento', DIA, true);
    await criarRota('Rota de outro dia', '2026-10-21', true);

    await comando(`rotas/${emAndamento.id}/confirmar-recebimento`);
    await comando(`rotas/${emAndamento.id}/iniciar`);
    const p1 = emAndamento.paradas[0]!;
    await comando(`paradas/${p1.id}/seguir`);
    await comando(`paradas/${p1.id}/ocorrencias`, { tipo: 'OUTRO', descricao: 'Portão fechado na chegada' });

    const res = await comoAdmin(api().get(`/api/v1/painel/hoje?data=${DIA}`)).expect(200);
    const painel = painelHojeSchema.parse(res.body);

    expect(painel.data).toBe(DIA);
    expect(painel.rotas.map((r) => r.nome)).toEqual(['Rota A em andamento', 'Rota B rascunho']);
    const [andamento, semEnvio] = painel.rotas;
    expect(andamento).toMatchObject({
      status: 'EM_ANDAMENTO',
      totalParadas: 2,
      paradasConcluidas: 0,
      paradaAtual: { id: p1.id, status: 'A_CAMINHO', nomeEmpresa: p1.nomeEmpresa },
      ocorrencias: 1,
    });
    expect(andamento!.ultimaAtividadeEm).not.toBeNull();
    expect(semEnvio).toMatchObject({ id: rascunho.id, status: 'RASCUNHO', paradaAtual: null, ocorrencias: 0 });

    expect(painel.ocorrencias).toEqual([
      expect.objectContaining({
        tipo: 'OUTRO',
        descricao: 'Portão fechado na chegada',
        servicoTipo: null,
        rotaId: emAndamento.id,
        rotaNome: 'Rota A em andamento',
        paradaId: p1.id,
        nomeEmpresa: p1.nomeEmpresa,
        motoristaNome: motorista.motorista.nome,
      }),
    ]);
  });

  it('sem data usa o dia de hoje em São Paulo', async () => {
    const hoje = hojeEmSaoPaulo();
    const rota = await criarRota('Rota de hoje', hoje, true);
    const painel = painelHojeSchema.parse((await comoAdmin(api().get('/api/v1/painel/hoje')).expect(200)).body);
    expect(painel.data).toBe(hoje);
    expect(painel.rotas.map((r) => r.id)).toEqual([rota.id]);
  });

  it('dia sem rotas devolve listas vazias', async () => {
    const painel = painelHojeSchema.parse((await comoAdmin(api().get(`/api/v1/painel/hoje?data=${DIA}`)).expect(200)).body);
    expect(painel).toEqual({ data: DIA, rotas: [], ocorrencias: [] });
  });

  it('só o admin acessa e a data é validada', async () => {
    await api().get('/api/v1/painel/hoje').expect(401);
    await api().get('/api/v1/painel/hoje').set('Authorization', `Bearer ${motorista.accessToken}`).expect(403);
    await comoAdmin(api().get('/api/v1/painel/hoje?data=20-10-2026')).expect(400);
  });
});

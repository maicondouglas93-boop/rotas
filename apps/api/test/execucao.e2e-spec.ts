import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eventoRotaSchema, respostaErroSchema, rotaResumoSchema, rotaSchema, type Rota } from '@rotas/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { carregarEnv } from '../src/config/env.js';
import { configurarApp } from '../src/configurar-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { autenticarAdminTeste, autenticarMotoristaTeste, limparBancoTeste } from './apoio/autenticacao.js';

type MotoristaTeste = Awaited<ReturnType<typeof autenticarMotoristaTeste>>;

describe('Execução pelo motorista (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;
  let motorista: MotoristaTeste;

  const api = () => request(app.getHttpServer());
  const comoAdmin = <T extends request.Test>(req: T) => req.set('Authorization', `Bearer ${tokenAdmin}`);
  const codigo = (body: unknown) => respostaErroSchema.parse(body).erro.codigo;

  /** Comando do motorista com Idempotency-Key (nova a cada chamada, salvo quando informada). */
  function comando(m: MotoristaTeste, caminho: string, corpo: object = {}, chave = randomUUID()) {
    return api()
      .post(`/api/v1/motorista/${caminho}`)
      .set('Authorization', `Bearer ${m.accessToken}`)
      .set('Idempotency-Key', chave)
      .send(corpo);
  }

  async function ok(req: request.Test): Promise<Rota> {
    const res = await req;
    if (res.status !== 200) throw new Error(`esperado 200, veio ${res.status}: ${JSON.stringify(res.body)}`);
    return rotaSchema.parse(res.body);
  }

  let contador = 0;
  async function criarEmpresa() {
    contador += 1;
    return prisma.empresa.create({
      data: {
        nomeFantasia: `Empresa ${contador}`,
        telefone: '+5511987654321',
        logradouro: 'Rua A',
        numero: String(contador),
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '01011100',
      },
    });
  }

  /** Rota enviada ao motorista: 1ª parada com coleta e entrega, demais só entrega. */
  async function rotaEnviada(m: MotoristaTeste = motorista, paradas = 2): Promise<Rota> {
    const empresas = await Promise.all(Array.from({ length: paradas }, criarEmpresa));
    const criada = rotaSchema.parse(
      (
        await comoAdmin(api().post('/api/v1/rotas'))
          .send({
            nome: 'Rota do Dia',
            dataPrevista: '2026-10-20',
            motoristaId: m.motorista.id,
            paradas: empresas.map((e, i) => ({ empresaId: e.id, servicos: i === 0 ? ['COLETA', 'ENTREGA'] : ['ENTREGA'] })),
          })
          .expect(201)
      ).body,
    );
    return rotaSchema.parse(
      (await comoAdmin(api().post(`/api/v1/rotas/${criada.id}/enviar`)).send({ versao: criada.versao }).expect(200)).body,
    );
  }

  async function rotaIniciada(m: MotoristaTeste = motorista, paradas = 2): Promise<Rota> {
    const rota = await rotaEnviada(m, paradas);
    await ok(comando(m, `rotas/${rota.id}/confirmar-recebimento`));
    return ok(comando(m, `rotas/${rota.id}/iniciar`));
  }

  async function historico(rotaId: string) {
    const res = await comoAdmin(api().get(`/api/v1/rotas/${rotaId}/historico`)).expect(200);
    return z.array(eventoRotaSchema).parse(res.body);
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

  describe('fluxo completo', () => {
    it('do recebimento à conclusão automática, com ocorrência e histórico', async () => {
      const rota = await rotaEnviada();
      const recebida = await ok(comando(motorista, `rotas/${rota.id}/confirmar-recebimento`, { ocorridoEm: '2026-10-20T07:55:00-03:00' }));
      expect(recebida).toMatchObject({ status: 'RECEBIDA' });
      expect(recebida.recebidaEm).not.toBeNull();

      const iniciada = await ok(comando(motorista, `rotas/${rota.id}/iniciar`));
      expect(iniciada.status).toBe('EM_ANDAMENTO');

      const [p1, p2] = iniciada.paradas;
      expect((await ok(comando(motorista, `paradas/${p1!.id}/seguir`))).paradas[0]!.status).toBe('A_CAMINHO');
      expect((await ok(comando(motorista, `paradas/${p1!.id}/cheguei`))).paradas[0]!.status).toBe('NO_LOCAL');

      const [coleta, entrega] = p1!.servicos;
      const aposColeta = await ok(comando(motorista, `servicos/${coleta!.id}/realizar`));
      expect(aposColeta.paradas[0]).toMatchObject({ status: 'NO_LOCAL' });

      const aposEntrega = await ok(
        comando(motorista, `servicos/${entrega!.id}/nao-realizar`, { tipoOcorrencia: 'RECUSA_RECEBIMENTO' }),
      );
      expect(aposEntrega.paradas[0]!.status).toBe('FINALIZADA');
      expect(aposEntrega.paradas[0]!.servicos.map((s) => s.status)).toEqual(['REALIZADO', 'NAO_REALIZADO']);
      expect(aposEntrega.status).toBe('EM_ANDAMENTO');

      await ok(comando(motorista, `paradas/${p2!.id}/seguir`));
      await ok(comando(motorista, `paradas/${p2!.id}/cheguei`));
      const concluida = await ok(comando(motorista, `servicos/${p2!.servicos[0]!.id}/realizar`));
      expect(concluida.status).toBe('CONCLUIDA');
      expect(concluida.concluidaEm).not.toBeNull();

      const servico = await prisma.servico.findUniqueOrThrow({ where: { id: coleta!.id } });
      expect(servico.executadoPorMotoristaId).toBe(motorista.motorista.id);
      const ocorrencias = await prisma.ocorrencia.findMany({ where: { servicoId: entrega!.id } });
      expect(ocorrencias.map((o) => o.tipo)).toEqual(['RECUSA_RECEBIMENTO']);

      const eventos = await historico(rota.id);
      expect(eventos.map((e) => e.tipo)).toEqual([
        'ROTA_CRIADA',
        'ROTA_ENVIADA',
        'ROTA_RECEBIDA',
        'ROTA_INICIADA',
        'PARADA_A_CAMINHO',
        'PARADA_CHEGADA',
        'SERVICO_REALIZADO',
        'OCORRENCIA_REGISTRADA',
        'SERVICO_NAO_REALIZADO',
        'PARADA_FINALIZADA',
        'PARADA_A_CAMINHO',
        'PARADA_CHEGADA',
        'SERVICO_REALIZADO',
        'PARADA_FINALIZADA',
        'ROTA_CONCLUIDA',
      ]);
      const recebimento = eventos.find((e) => e.tipo === 'ROTA_RECEBIDA')!;
      expect(recebimento.ocorridoEm).toBe('2026-10-20T10:55:00.000Z');
      expect(eventos.filter((e) => e.autorUsuarioId === null).map((e) => e.tipo)).toEqual([
        'PARADA_FINALIZADA',
        'PARADA_FINALIZADA',
        'ROTA_CONCLUIDA',
      ]);
    });

    it('lista as rotas abertas e, depois, as concluídas', async () => {
      const rota = await rotaIniciada(motorista, 1);
      const listar = async (q = '') =>
        z
          .object({ itens: z.array(rotaResumoSchema), total: z.number() })
          .parse(
            (await api().get(`/api/v1/motorista/rotas${q}`).set('Authorization', `Bearer ${motorista.accessToken}`).expect(200))
              .body,
          );
      expect((await listar()).itens.map((r) => r.id)).toEqual([rota.id]);

      const p = rota.paradas[0]!;
      await ok(comando(motorista, `paradas/${p.id}/seguir`));
      await ok(comando(motorista, `paradas/${p.id}/cheguei`));
      for (const s of p.servicos) await ok(comando(motorista, `servicos/${s.id}/realizar`));

      expect((await listar()).total).toBe(0);
      expect((await listar('?status=CONCLUIDA')).itens[0]).toMatchObject({ id: rota.id, paradasConcluidas: 1, totalParadas: 1 });
    });
  });

  describe('isolamento entre motoristas', () => {
    it('outro motorista não vê nem altera a rota (404) e admin não usa estas rotas (403)', async () => {
      const rota = await rotaEnviada();
      const outro = await autenticarMotoristaTeste(app, prisma);
      await api().get(`/api/v1/motorista/rotas/${rota.id}`).set('Authorization', `Bearer ${outro.accessToken}`).expect(404);
      expect((await comando(outro, `rotas/${rota.id}/confirmar-recebimento`)).status).toBe(404);
      expect((await comando(outro, `paradas/${rota.paradas[0]!.id}/seguir`)).status).toBe(404);
      expect((await comando(outro, `servicos/${rota.paradas[0]!.servicos[0]!.id}/realizar`)).status).toBe(404);
      await api().get('/api/v1/motorista/rotas').set('Authorization', `Bearer ${tokenAdmin}`).expect(403);
    });

    it('rota em rascunho não aparece para o motorista', async () => {
      const empresa = await criarEmpresa();
      const rascunho = rotaSchema.parse(
        (
          await comoAdmin(api().post('/api/v1/rotas'))
            .send({
              nome: 'Ainda em montagem',
              dataPrevista: '2026-10-20',
              motoristaId: motorista.motorista.id,
              paradas: [{ empresaId: empresa.id, servicos: ['ENTREGA'] }],
            })
            .expect(201)
        ).body,
      );
      await api().get(`/api/v1/motorista/rotas/${rascunho.id}`).set('Authorization', `Bearer ${motorista.accessToken}`).expect(404);
      expect((await comando(motorista, `rotas/${rascunho.id}/confirmar-recebimento`)).status).toBe(404);
    });

    it('depois da transferência o motorista anterior perde o acesso', async () => {
      const rota = await rotaIniciada();
      await ok(comando(motorista, `paradas/${rota.paradas[0]!.id}/seguir`));
      const novo = await autenticarMotoristaTeste(app, prisma);
      const atual = rotaSchema.parse((await comoAdmin(api().get(`/api/v1/rotas/${rota.id}`))).body);
      await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/transferir`))
        .send({ versao: atual.versao, motoristaId: novo.motorista.id, motivo: 'Troca de turno' })
        .expect(200);

      expect((await comando(motorista, `paradas/${rota.paradas[0]!.id}/cheguei`)).status).toBe(404);
      await api().get(`/api/v1/motorista/rotas/${rota.id}`).set('Authorization', `Bearer ${novo.accessToken}`).expect(200);
    });
  });

  describe('idempotência', () => {
    it('a mesma chave devolve a mesma resposta sem repetir o comando', async () => {
      const rota = await rotaIniciada();
      const parada = rota.paradas[0]!;
      const chave = randomUUID();
      const primeira = await comando(motorista, `paradas/${parada.id}/seguir`, {}, chave).expect(200);
      const segunda = await comando(motorista, `paradas/${parada.id}/seguir`, {}, chave).expect(200);
      expect(segunda.body).toEqual(primeira.body);
      expect((await historico(rota.id)).filter((e) => e.tipo === 'PARADA_A_CAMINHO')).toHaveLength(1);
    });

    it('ocorrência repetida com a mesma chave é gravada uma vez só', async () => {
      const rota = await rotaIniciada();
      const parada = rota.paradas[0]!;
      await ok(comando(motorista, `paradas/${parada.id}/seguir`));
      const chave = randomUUID();
      await comando(motorista, `paradas/${parada.id}/ocorrencias`, { tipo: 'EMPRESA_FECHADA' }, chave).expect(200);
      await comando(motorista, `paradas/${parada.id}/ocorrencias`, { tipo: 'EMPRESA_FECHADA' }, chave).expect(200);
      expect(await prisma.ocorrencia.count({ where: { paradaId: parada.id } })).toBe(1);
    });

    it('a mesma chave em outro comando é recusada (422)', async () => {
      const rota = await rotaIniciada();
      const chave = randomUUID();
      await comando(motorista, `paradas/${rota.paradas[0]!.id}/seguir`, {}, chave).expect(200);
      const res = await comando(motorista, `paradas/${rota.paradas[1]!.id}/seguir`, {}, chave).expect(422);
      expect(codigo(res.body)).toBe('REGRA_NEGOCIO');
    });

    it('sem Idempotency-Key responde 400', async () => {
      const rota = await rotaEnviada();
      const res = await api()
        .post(`/api/v1/motorista/rotas/${rota.id}/confirmar-recebimento`)
        .set('Authorization', `Bearer ${motorista.accessToken}`)
        .send({})
        .expect(400);
      expect(codigo(res.body)).toBe('VALIDACAO');
    });

    it('reenvio com outra chave depois do destino atingido devolve o estado atual sem novo evento', async () => {
      const rota = await rotaIniciada();
      const parada = rota.paradas[0]!;
      await ok(comando(motorista, `paradas/${parada.id}/seguir`));
      await ok(comando(motorista, `paradas/${parada.id}/cheguei`));
      const denovo = await ok(comando(motorista, `paradas/${parada.id}/cheguei`));
      expect(denovo.paradas[0]!.status).toBe('NO_LOCAL');
      expect((await historico(rota.id)).filter((e) => e.tipo === 'PARADA_CHEGADA')).toHaveLength(1);
    });
  });

  describe('ordem dos comandos', () => {
    it('não inicia sem confirmar o recebimento', async () => {
      const rota = await rotaEnviada();
      const res = await comando(motorista, `rotas/${rota.id}/iniciar`).expect(409);
      expect(codigo(res.body)).toBe('TRANSICAO_INVALIDA');
    });

    it('não segue para parada com a rota ainda não iniciada', async () => {
      const rota = await rotaEnviada();
      await ok(comando(motorista, `rotas/${rota.id}/confirmar-recebimento`));
      await comando(motorista, `paradas/${rota.paradas[0]!.id}/seguir`).expect(409);
    });

    it('não realiza serviço antes de chegar', async () => {
      const rota = await rotaIniciada();
      await ok(comando(motorista, `paradas/${rota.paradas[0]!.id}/seguir`));
      await comando(motorista, `servicos/${rota.paradas[0]!.servicos[0]!.id}/realizar`).expect(409);
    });

    it('seguir para outra parada devolve a que estava a caminho para a fila', async () => {
      const rota = await rotaIniciada();
      await ok(comando(motorista, `paradas/${rota.paradas[0]!.id}/seguir`));
      const depois = await ok(comando(motorista, `paradas/${rota.paradas[1]!.id}/seguir`));
      expect(depois.paradas.map((p) => p.status)).toEqual(['PENDENTE', 'A_CAMINHO']);
    });

    it('não segue para outra parada estando no local de uma', async () => {
      const rota = await rotaIniciada();
      await ok(comando(motorista, `paradas/${rota.paradas[0]!.id}/seguir`));
      await ok(comando(motorista, `paradas/${rota.paradas[0]!.id}/cheguei`));
      const res = await comando(motorista, `paradas/${rota.paradas[1]!.id}/seguir`).expect(409);
      expect(respostaErroSchema.parse(res.body).erro.mensagem).toContain('Finalize a parada');
    });

    it('não inicia uma segunda rota com outra em andamento', async () => {
      await rotaIniciada();
      const segunda = await rotaEnviada();
      await ok(comando(motorista, `rotas/${segunda.id}/confirmar-recebimento`));
      const res = await comando(motorista, `rotas/${segunda.id}/iniciar`).expect(409);
      expect(respostaErroSchema.parse(res.body).erro.mensagem).toContain('Conclua a rota em andamento');
    });

    it('parada cancelada pelo admin enquanto o app estava sem sinal: o comando atrasado é recusado', async () => {
      const rota = await rotaIniciada();
      const parada = rota.paradas[1]!;
      const atual = rotaSchema.parse((await comoAdmin(api().get(`/api/v1/rotas/${rota.id}`))).body);
      await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/paradas/${parada.id}/cancelar`))
        .send({ versao: atual.versao, motivo: 'Cliente cancelou' })
        .expect(200);
      const res = await comando(motorista, `paradas/${parada.id}/seguir`).expect(409);
      expect(codigo(res.body)).toBe('TRANSICAO_INVALIDA');
    });
  });

  describe('ocorrências', () => {
    it('registra ocorrência informativa na parada a caminho', async () => {
      const rota = await rotaIniciada();
      const parada = rota.paradas[0]!;
      await ok(comando(motorista, `paradas/${parada.id}/seguir`));
      await ok(comando(motorista, `paradas/${parada.id}/ocorrencias`, { tipo: 'OUTRO', descricao: 'Rua interditada por obra' }));
      const ocorrencia = await prisma.ocorrencia.findFirstOrThrow({ where: { paradaId: parada.id } });
      expect(ocorrencia).toMatchObject({ tipo: 'OUTRO', descricao: 'Rua interditada por obra', servicoId: null });
    });

    it('"Outro" sem descrição é 400 e ocorrência em parada pendente é 409', async () => {
      const rota = await rotaIniciada();
      const parada = rota.paradas[0]!;
      await comando(motorista, `paradas/${parada.id}/ocorrencias`, { tipo: 'OUTRO' }).expect(400);
      await comando(motorista, `paradas/${parada.id}/ocorrencias`, { tipo: 'EMPRESA_FECHADA' }).expect(409);
    });
  });
});

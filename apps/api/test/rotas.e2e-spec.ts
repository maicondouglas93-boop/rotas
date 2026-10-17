import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  eventoRotaSchema,
  respostaErroSchema,
  rotaDuplicadaSchema,
  rotaResumoSchema,
  rotaSchema,
  type Rota,
  type StatusParada,
} from '@rotas/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { carregarEnv } from '../src/config/env.js';
import { configurarApp } from '../src/configurar-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { autenticarAdminTeste, autenticarMotoristaTeste, criarMotoristaTeste, limparBancoTeste } from './apoio/autenticacao.js';

const paginaRotasSchema = z.object({
  itens: z.array(rotaResumoSchema),
  total: z.number(),
  pagina: z.number(),
  porPagina: z.number(),
});

describe('Rotas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;

  const api = () => request(app.getHttpServer());
  const comoAdmin = <T extends request.Test>(req: T) => req.set('Authorization', `Bearer ${tokenAdmin}`);
  const codigo = (body: unknown) => respostaErroSchema.parse(body).erro.codigo;
  const mensagem = (body: unknown) => respostaErroSchema.parse(body).erro.mensagem;

  let contador = 0;
  async function criarEmpresa(nome = `Empresa ${++contador}`, extras: { arquivadaEm?: Date } = {}) {
    return prisma.empresa.create({
      data: {
        nomeFantasia: nome,
        telefone: '+5511987654321',
        whatsapp: '+5511912345678',
        logradouro: 'Rua São Bento',
        numero: String(100 + contador),
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '01011100',
        latitude: -23.55,
        longitude: -46.63,
        ...extras,
      },
    });
  }

  async function criarRota(corpo: Record<string, unknown>): Promise<Rota> {
    const res = await comoAdmin(api().post('/api/v1/rotas'))
      .send({ nome: 'Rota Centro', dataPrevista: '2026-10-20', ...corpo })
      .expect(201);
    return rotaSchema.parse(res.body);
  }

  async function rotaPronta(paradas = 2) {
    const { motorista } = await criarMotoristaTeste(prisma);
    const empresas = await Promise.all(Array.from({ length: paradas }, () => criarEmpresa()));
    const rota = await criarRota({
      motoristaId: motorista.id,
      paradas: empresas.map((e) => ({ empresaId: e.id, servicos: ['ENTREGA'] })),
    });
    return { rota, motorista, empresas };
  }

  async function enviar(rota: Rota) {
    const res = await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/enviar`)).send({ versao: rota.versao }).expect(200);
    return rotaSchema.parse(res.body);
  }

  /** Os comandos do motorista ainda não existem: monta o estado de execução direto no banco. */
  async function colocarEmAndamento(rota: Rota, statusParadas: StatusParada[]) {
    await prisma.rota.update({ where: { id: rota.id }, data: { status: 'EM_ANDAMENTO', iniciadaEm: new Date() } });
    for (const [i, status] of statusParadas.entries()) {
      const parada = rota.paradas[i]!;
      await prisma.parada.update({ where: { id: parada.id }, data: { status } });
      if (status === 'FINALIZADA') {
        await prisma.servico.updateMany({ where: { paradaId: parada.id }, data: { status: 'REALIZADO' } });
      }
    }
    return rotaSchema.parse((await comoAdmin(api().get(`/api/v1/rotas/${rota.id}`)).expect(200)).body);
  }

  const paraEdicao = (rota: Rota) => ({
    versao: rota.versao,
    nome: rota.nome,
    dataPrevista: rota.dataPrevista,
    motoristaId: rota.motorista?.id ?? null,
    paradas: rota.paradas.map((p) => ({
      id: p.id,
      empresaId: p.empresaId,
      servicos: p.servicos.map((s) => s.tipo),
      observacoes: p.observacoes,
    })),
  });

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
    it('motorista não usa a montagem de rotas (403) e sem token é 401', async () => {
      const motorista = await autenticarMotoristaTeste(app, prisma);
      await api().get('/api/v1/rotas').set('Authorization', `Bearer ${motorista.accessToken}`).expect(403);
      await api().get('/api/v1/rotas').expect(401);
    });
  });

  describe('criar', () => {
    it('cria rascunho com paradas em ordem, snapshot da empresa e evento', async () => {
      const a = await criarEmpresa('Mercado Alfa');
      const b = await criarEmpresa('Padaria Beta');
      const rota = await criarRota({
        paradas: [
          { empresaId: b.id, servicos: ['COLETA', 'ENTREGA'], observacoes: 'Portão lateral' },
          { empresaId: a.id, servicos: ['ENTREGA'] },
        ],
      });
      expect(rota).toMatchObject({ status: 'RASCUNHO', versao: 1, motorista: null, dataPrevista: '2026-10-20' });
      expect(rota.paradas.map((p) => [p.sequencia, p.nomeEmpresa])).toEqual([
        [1, 'Padaria Beta'],
        [2, 'Mercado Alfa'],
      ]);
      expect(rota.paradas[0]!.servicos.map((s) => s.tipo)).toEqual(['COLETA', 'ENTREGA']);
      expect(rota.paradas[0]!.enderecoFormatado).toContain('Rua São Bento');
      expect(rota.paradas[0]!.observacoes).toBe('Portão lateral');

      const eventos = z.array(eventoRotaSchema).parse((await comoAdmin(api().get(`/api/v1/rotas/${rota.id}/historico`))).body);
      expect(eventos.map((e) => e.tipo)).toEqual(['ROTA_CRIADA']);
    });

    it('recusa empresa arquivada, empresa inexistente e motorista desativado (422)', async () => {
      const arquivada = await criarEmpresa('Antiga', { arquivadaEm: new Date() });
      const r1 = await comoAdmin(api().post('/api/v1/rotas'))
        .send({ nome: 'Rota X', dataPrevista: '2026-10-20', paradas: [{ empresaId: arquivada.id, servicos: ['ENTREGA'] }] })
        .expect(422);
      expect(mensagem(r1.body)).toContain('Antiga está arquivada');

      await comoAdmin(api().post('/api/v1/rotas'))
        .send({
          nome: 'Rota X',
          dataPrevista: '2026-10-20',
          paradas: [{ empresaId: '00000000-0000-4000-8000-000000000000', servicos: ['ENTREGA'] }],
        })
        .expect(422);

      const { motorista } = await criarMotoristaTeste(prisma, { ativo: false });
      await comoAdmin(api().post('/api/v1/rotas'))
        .send({ nome: 'Rota X', dataPrevista: '2026-10-20', motoristaId: motorista.id })
        .expect(422);
    });

    it('o snapshot não muda quando o cadastro da empresa muda', async () => {
      const { rota, empresas } = await rotaPronta(1);
      await comoAdmin(api().patch(`/api/v1/empresas/${empresas[0]!.id}`)).send({ nomeFantasia: 'Nome Novo' }).expect(200);
      const atual = rotaSchema.parse((await comoAdmin(api().get(`/api/v1/rotas/${rota.id}`))).body);
      expect(atual.paradas[0]!.nomeEmpresa).toBe(rota.paradas[0]!.nomeEmpresa);
    });
  });

  describe('listar', () => {
    it('filtra por status, data, motorista e nome, com contagem de paradas', async () => {
      const { rota: r1, motorista } = await rotaPronta(3);
      await enviar(r1);
      await criarRota({ nome: 'Rota Norte', dataPrevista: '2026-10-25' });

      const enviadas = paginaRotasSchema.parse(
        (await comoAdmin(api().get('/api/v1/rotas?status=ENVIADA,RECEBIDA')).expect(200)).body,
      );
      expect(enviadas.itens.map((r) => r.id)).toEqual([r1.id]);
      expect(enviadas.itens[0]).toMatchObject({ totalParadas: 3, paradasConcluidas: 0, motorista: { ativo: true } });

      const porData = paginaRotasSchema.parse(
        (await comoAdmin(api().get('/api/v1/rotas?dataDe=2026-10-21&dataAte=2026-10-31')).expect(200)).body,
      );
      expect(porData.itens.map((r) => r.nome)).toEqual(['Rota Norte']);

      const porMotorista = paginaRotasSchema.parse(
        (await comoAdmin(api().get(`/api/v1/rotas?motoristaId=${motorista.id}`)).expect(200)).body,
      );
      expect(porMotorista.total).toBe(1);

      const todas = paginaRotasSchema.parse((await comoAdmin(api().get('/api/v1/rotas?busca=norte')).expect(200)).body);
      expect(todas.itens.map((r) => r.nome)).toEqual(['Rota Norte']);
    });

    it('detalhe inexistente é 404', async () => {
      await comoAdmin(api().get('/api/v1/rotas/00000000-0000-4000-8000-000000000000')).expect(404);
    });
  });

  describe('editar', () => {
    it('em rascunho reordena, remove, adiciona e troca serviços, incrementando a versão', async () => {
      const { rota } = await rotaPronta(3);
      const nova = await criarEmpresa('Farmácia Gama');
      const [p1, p2, p3] = paraEdicao(rota).paradas;
      const res = await comoAdmin(api().put(`/api/v1/rotas/${rota.id}`))
        .send({
          ...paraEdicao(rota),
          nome: 'Rota Centro Revisada',
          paradas: [{ ...p3, servicos: ['COLETA', 'ENTREGA'] }, { empresaId: nova.id, servicos: ['COLETA'] }, p1],
        })
        .expect(200);
      const editada = rotaSchema.parse(res.body);
      expect(editada.versao).toBe(rota.versao + 1);
      expect(editada.nome).toBe('Rota Centro Revisada');
      expect(editada.paradas.map((p) => [p.sequencia, p.id === p3!.id, p.nomeEmpresa])).toEqual([
        [1, true, rota.paradas[2]!.nomeEmpresa],
        [2, false, 'Farmácia Gama'],
        [3, false, rota.paradas[0]!.nomeEmpresa],
      ]);
      expect(editada.paradas[0]!.servicos.map((s) => s.tipo)).toEqual(['COLETA', 'ENTREGA']);
      expect(editada.paradas.some((p) => p.id === p2!.id)).toBe(false);
    });

    it('versão desatualizada responde 409 CONFLITO_VERSAO', async () => {
      const { rota } = await rotaPronta(1);
      await comoAdmin(api().put(`/api/v1/rotas/${rota.id}`)).send({ ...paraEdicao(rota), nome: 'Primeira' }).expect(200);
      const res = await comoAdmin(api().put(`/api/v1/rotas/${rota.id}`))
        .send({ ...paraEdicao(rota), nome: 'Segunda' })
        .expect(409);
      expect(codigo(res.body)).toBe('CONFLITO_VERSAO');
    });

    it('rota recebida volta para ENVIADA ao ser editada, e o motorista não muda depois do envio', async () => {
      const { rota } = await rotaPronta(2);
      const enviada = await enviar(rota);
      await prisma.rota.update({ where: { id: rota.id }, data: { status: 'RECEBIDA', recebidaEm: new Date() } });

      const res = await comoAdmin(api().put(`/api/v1/rotas/${rota.id}`))
        .send({ ...paraEdicao(enviada), paradas: paraEdicao(enviada).paradas.slice(0, 1) })
        .expect(200);
      expect(rotaSchema.parse(res.body)).toMatchObject({ status: 'ENVIADA', recebidaEm: null });

      const atual = rotaSchema.parse(res.body);
      const outro = await criarMotoristaTeste(prisma);
      const troca = await comoAdmin(api().put(`/api/v1/rotas/${rota.id}`))
        .send({ ...paraEdicao(atual), motoristaId: outro.motorista.id })
        .expect(422);
      expect(mensagem(troca.body)).toContain('transferência');
    });

    it('em andamento: adiciona parada, mas não remove nem altera parada finalizada', async () => {
      const { rota } = await rotaPronta(3);
      const emAndamento = await colocarEmAndamento(await enviar(rota), ['FINALIZADA', 'A_CAMINHO', 'PENDENTE']);
      const base = paraEdicao(emAndamento);
      const extra = await criarEmpresa('Nova no Meio do Caminho');

      const adicionou = await comoAdmin(api().put(`/api/v1/rotas/${rota.id}`))
        .send({ ...base, paradas: [...base.paradas, { empresaId: extra.id, servicos: ['ENTREGA'] }] })
        .expect(200);
      const depois = rotaSchema.parse(adicionou.body);
      expect(depois).toMatchObject({ status: 'EM_ANDAMENTO' });
      expect(depois.paradas.at(-1)).toMatchObject({ nomeEmpresa: 'Nova no Meio do Caminho', status: 'PENDENTE' });

      const base2 = paraEdicao(depois);
      const removeu = await comoAdmin(api().put(`/api/v1/rotas/${rota.id}`))
        .send({ ...base2, paradas: base2.paradas.slice(1) })
        .expect(422);
      expect(mensagem(removeu.body)).toContain('cancele a parada');

      const alterou = await comoAdmin(api().put(`/api/v1/rotas/${rota.id}`))
        .send({ ...base2, paradas: [{ ...base2.paradas[0]!, observacoes: 'mudou' }, ...base2.paradas.slice(1)] })
        .expect(422);
      expect(codigo(alterou.body)).toBe('REGRA_NEGOCIO');
    });
  });

  describe('enviar', () => {
    it('recusa rota sem motorista ou sem paradas', async () => {
      const semMotorista = await criarRota({ paradas: [{ empresaId: (await criarEmpresa()).id, servicos: ['ENTREGA'] }] });
      const r1 = await comoAdmin(api().post(`/api/v1/rotas/${semMotorista.id}/enviar`)).send({ versao: 1 }).expect(422);
      expect(mensagem(r1.body)).toContain('Defina o motorista');

      const { motorista } = await criarMotoristaTeste(prisma);
      const semParadas = await criarRota({ motoristaId: motorista.id });
      const r2 = await comoAdmin(api().post(`/api/v1/rotas/${semParadas.id}/enviar`)).send({ versao: 1 }).expect(422);
      expect(mensagem(r2.body)).toContain('ao menos uma parada');
    });

    it('envia, registra evento e não envia duas vezes', async () => {
      const { rota } = await rotaPronta(1);
      const enviada = await enviar(rota);
      expect(enviada).toMatchObject({ status: 'ENVIADA', versao: 2 });
      expect(enviada.enviadaEm).not.toBeNull();

      const denovo = await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/enviar`)).send({ versao: 2 }).expect(409);
      expect(codigo(denovo.body)).toBe('TRANSICAO_INVALIDA');

      const eventos = z.array(eventoRotaSchema).parse((await comoAdmin(api().get(`/api/v1/rotas/${rota.id}/historico`))).body);
      expect(eventos.map((e) => e.tipo)).toEqual(['ROTA_CRIADA', 'ROTA_ENVIADA']);
    });

    it('recusa enviar com empresa arquivada depois da montagem', async () => {
      const { rota, empresas } = await rotaPronta(1);
      await comoAdmin(api().post(`/api/v1/empresas/${empresas[0]!.id}/arquivar`)).expect(200);
      const res = await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/enviar`)).send({ versao: 1 }).expect(422);
      expect(mensagem(res.body)).toContain('arquivada');
    });

    it('recusa enviar quando o motorista foi desativado', async () => {
      const { rota, motorista } = await rotaPronta(1);
      await comoAdmin(api().post(`/api/v1/motoristas/${motorista.id}/desativar`)).expect(200);
      const res = await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/enviar`)).send({ versao: 1 }).expect(422);
      expect(mensagem(res.body)).toContain('desativado');
    });
  });

  describe('cancelar', () => {
    it('cancela as paradas abertas e mantém o que já foi executado', async () => {
      const { rota } = await rotaPronta(3);
      const emAndamento = await colocarEmAndamento(await enviar(rota), ['FINALIZADA', 'NO_LOCAL', 'PENDENTE']);
      const res = await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/cancelar`))
        .send({ versao: emAndamento.versao, motivo: 'Veículo quebrou' })
        .expect(200);
      const cancelada = rotaSchema.parse(res.body);
      expect(cancelada).toMatchObject({ status: 'CANCELADA', motivoCancelamento: 'Veículo quebrou' });
      expect(cancelada.paradas.map((p) => p.status)).toEqual(['FINALIZADA', 'CANCELADA', 'CANCELADA']);
      expect(cancelada.paradas[0]!.servicos[0]!.status).toBe('REALIZADO');
      expect(cancelada.paradas[2]!.servicos[0]!.status).toBe('CANCELADO');
    });

    it('exige motivo (400) e não cancela rota já cancelada (409)', async () => {
      const { rota } = await rotaPronta(1);
      await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/cancelar`)).send({ versao: 1, motivo: 'x' }).expect(400);
      await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/cancelar`)).send({ versao: 1, motivo: 'Cliente desistiu' }).expect(200);
      await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/cancelar`)).send({ versao: 2, motivo: 'De novo aqui' }).expect(409);
    });
  });

  describe('transferir', () => {
    it('em andamento: novo motorista, rota volta para ENVIADA e a parada ativa volta para a fila', async () => {
      const { rota, motorista } = await rotaPronta(3);
      const emAndamento = await colocarEmAndamento(await enviar(rota), ['FINALIZADA', 'NO_LOCAL', 'PENDENTE']);
      const novo = await criarMotoristaTeste(prisma);

      const res = await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/transferir`))
        .send({ versao: emAndamento.versao, motoristaId: novo.motorista.id, motivo: 'Troca de turno' })
        .expect(200);
      const transferida = rotaSchema.parse(res.body);
      expect(transferida).toMatchObject({ status: 'ENVIADA', recebidaEm: null, motorista: { id: novo.motorista.id } });
      expect(transferida.paradas.map((p) => p.status)).toEqual(['FINALIZADA', 'PENDENTE', 'PENDENTE']);

      const eventos = z.array(eventoRotaSchema).parse((await comoAdmin(api().get(`/api/v1/rotas/${rota.id}/historico`))).body);
      expect(eventos.at(-1)).toMatchObject({
        tipo: 'ROTA_TRANSFERIDA',
        dados: { deMotoristaId: motorista.id, paraMotoristaId: novo.motorista.id, paradasDevolvidas: 1 },
      });
    });

    it('recusa o mesmo motorista e motorista desativado (422)', async () => {
      const { rota, motorista } = await rotaPronta(1);
      const enviada = await enviar(rota);
      await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/transferir`))
        .send({ versao: enviada.versao, motoristaId: motorista.id, motivo: 'Sem motivo real' })
        .expect(422);
      const inativo = await criarMotoristaTeste(prisma, { ativo: false });
      await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/transferir`))
        .send({ versao: enviada.versao, motoristaId: inativo.motorista.id, motivo: 'Troca de turno' })
        .expect(422);
    });
  });

  describe('cancelar parada', () => {
    it('cancelar a última parada aberta conclui a rota automaticamente', async () => {
      const { rota } = await rotaPronta(2);
      const emAndamento = await colocarEmAndamento(await enviar(rota), ['FINALIZADA', 'PENDENTE']);
      const res = await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/paradas/${emAndamento.paradas[1]!.id}/cancelar`))
        .send({ versao: emAndamento.versao, motivo: 'Empresa fechou' })
        .expect(200);
      const concluida = rotaSchema.parse(res.body);
      expect(concluida.status).toBe('CONCLUIDA');
      expect(concluida.concluidaEm).not.toBeNull();

      const eventos = z.array(eventoRotaSchema).parse((await comoAdmin(api().get(`/api/v1/rotas/${rota.id}/historico`))).body);
      expect(eventos.slice(-2).map((e) => [e.tipo, e.autorUsuarioId === null])).toEqual([
        ['PARADA_CANCELADA', false],
        ['ROTA_CONCLUIDA', true],
      ]);
    });

    it('antes do início a parada não é cancelada (409)', async () => {
      const { rota } = await rotaPronta(1);
      const res = await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/paradas/${rota.paradas[0]!.id}/cancelar`))
        .send({ versao: 1, motivo: 'Empresa fechou' })
        .expect(409);
      expect(codigo(res.body)).toBe('TRANSICAO_INVALIDA');
    });
  });

  describe('duplicar e excluir', () => {
    it('duplica como rascunho sem motorista e omite empresas arquivadas', async () => {
      const { rota, empresas } = await rotaPronta(2);
      await comoAdmin(api().post(`/api/v1/empresas/${empresas[1]!.id}/arquivar`)).expect(200);
      const res = await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/duplicar`))
        .send({ dataPrevista: '2026-10-27' })
        .expect(201);
      const { rota: copia, empresasOmitidas } = rotaDuplicadaSchema.parse(res.body);
      expect(copia).toMatchObject({
        status: 'RASCUNHO',
        motorista: null,
        rotaOrigemId: rota.id,
        dataPrevista: '2026-10-27',
        nome: 'Rota Centro (cópia)',
      });
      expect(copia.paradas).toHaveLength(1);
      expect(empresasOmitidas).toEqual([{ empresaId: empresas[1]!.id, nomeEmpresa: rota.paradas[1]!.nomeEmpresa }]);
    });

    it('exclui rascunho e recusa excluir rota enviada', async () => {
      const rascunho = await criarRota({});
      await comoAdmin(api().delete(`/api/v1/rotas/${rascunho.id}?versao=1`)).expect(204);
      await comoAdmin(api().get(`/api/v1/rotas/${rascunho.id}`)).expect(404);

      const { rota } = await rotaPronta(1);
      const enviada = await enviar(rota);
      const res = await comoAdmin(api().delete(`/api/v1/rotas/${rota.id}?versao=${enviada.versao}`)).expect(409);
      expect(codigo(res.body)).toBe('TRANSICAO_INVALIDA');
    });
  });
});

import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { comprovanteRotaSchema, respostaErroSchema, rotaSchema, type Rota } from '@rotas/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { carregarEnv } from '../src/config/env.js';
import { configurarApp } from '../src/configurar-app.js';
import { ArmazenamentoEmDisco } from '../src/modulos/armazenamento/armazenamento-disco.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { autenticarAdminTeste, autenticarMotoristaTeste, limparBancoTeste } from './apoio/autenticacao.js';

type MotoristaTeste = Awaited<ReturnType<typeof autenticarMotoristaTeste>>;

/** Menor JPEG válido (1×1): começa com FF D8 FF. */
const JPEG_MINIMO =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const ASSINATURA = { largura: 300, altura: 150, tracos: [[10, 10, 50, 60, 90, 40], [120, 30, 160, 90]] };

describe('Comprovante de entrega (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let pasta: string;
  let tokenAdmin: string;
  let motorista: MotoristaTeste;

  const api = () => request(app.getHttpServer());
  const comoAdmin = <T extends request.Test>(req: T) => req.set('Authorization', `Bearer ${tokenAdmin}`);
  const codigo = (body: unknown) => respostaErroSchema.parse(body).erro.codigo;

  function comando(caminho: string, corpo: object = {}, chave = randomUUID()) {
    return api()
      .post(`/api/v1/motorista/${caminho}`)
      .set('Authorization', `Bearer ${motorista.accessToken}`)
      .set('Idempotency-Key', chave)
      .send(corpo);
  }

  /** Rota iniciada, com o motorista no local da única parada (uma entrega). */
  async function noLocal(): Promise<{ rota: Rota; servicoId: string }> {
    const empresa = await prisma.empresa.create({
      data: {
        nomeFantasia: 'Mercado Comprovante',
        telefone: '+5511987654321',
        logradouro: 'Rua A',
        numero: '1',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '01011100',
      },
    });
    const criada = rotaSchema.parse(
      (
        await comoAdmin(api().post('/api/v1/rotas'))
          .send({
            nome: 'Rota com comprovante',
            dataPrevista: '2026-10-20',
            motoristaId: motorista.motorista.id,
            paradas: [{ empresaId: empresa.id, servicos: ['ENTREGA'] }],
          })
          .expect(201)
      ).body,
    );
    await comoAdmin(api().post(`/api/v1/rotas/${criada.id}/enviar`)).send({ versao: criada.versao }).expect(200);
    await comando(`rotas/${criada.id}/confirmar-recebimento`).expect(200);
    await comando(`rotas/${criada.id}/iniciar`).expect(200);
    const parada = criada.paradas[0]!;
    await comando(`paradas/${parada.id}/seguir`).expect(200);
    await comando(`paradas/${parada.id}/cheguei`).expect(200);
    return { rota: criada, servicoId: parada.servicos[0]!.id };
  }

  async function comprovantes(rotaId: string) {
    const res = await comoAdmin(api().get(`/api/v1/rotas/${rotaId}/comprovantes`)).expect(200);
    return z.array(comprovanteRotaSchema).parse(res.body);
  }

  async function arquivosDaRota(rotaId: string): Promise<string[]> {
    return readdir(path.join(pasta, 'comprovantes', rotaId)).catch(() => []);
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    const env = carregarEnv();
    configurarApp(app, env);
    await app.init();
    prisma = app.get(PrismaService);
    pasta = path.resolve(env.ARMAZENAMENTO_PASTA);
  });

  beforeEach(async () => {
    await limparBancoTeste(prisma);
    tokenAdmin = (await autenticarAdminTeste(app, prisma)).accessToken;
    motorista = await autenticarMotoristaTeste(app, prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('entrega com foto, assinatura e nome: o admin vê o comprovante e abre a foto pelo link assinado', async () => {
    const { rota, servicoId } = await noLocal();
    const res = await comando(`servicos/${servicoId}/realizar`, {
      comprovante: { nomeRecebedor: 'Maria Souza', assinatura: ASSINATURA, fotoJpegBase64: JPEG_MINIMO },
    }).expect(200);
    expect(rotaSchema.parse(res.body).status).toBe('CONCLUIDA');

    const [comprovante, ...outros] = await comprovantes(rota.id);
    expect(outros).toEqual([]);
    expect(comprovante).toMatchObject({
      servicoId,
      paradaId: rota.paradas[0]!.id,
      nomeRecebedor: 'Maria Souza',
      assinatura: ASSINATURA,
      motorista: { id: motorista.motorista.id },
    });
    expect(comprovante!.fotoUrl).toMatch(/^\/api\/v1\/arquivos\/comprovantes\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg\?expira=\d+&assinatura=/);

    const foto = await api().get(comprovante!.fotoUrl!).buffer(true).expect(200);
    expect(foto.headers['content-type']).toBe('image/jpeg');
    expect(foto.headers['cross-origin-resource-policy']).toBe('cross-site');
    expect(Buffer.from(foto.body as Buffer).equals(Buffer.from(JPEG_MINIMO, 'base64'))).toBe(true);

    // Link adulterado ou vencido não abre (404, sem dizer o motivo).
    await api().get(comprovante!.fotoUrl!.replace(/assinatura=./, 'assinatura=X')).expect(404);
    const chave = comprovante!.fotoUrl!.split('?')[0]!.replace('/api/v1/arquivos/', '');
    const vencido = app.get(ArmazenamentoEmDisco).urlLeitura(chave, -60);
    await api().get(vencido).expect(404);
  });

  it('só com o nome de quem recebeu, sem foto', async () => {
    const { rota, servicoId } = await noLocal();
    await comando(`servicos/${servicoId}/realizar`, { comprovante: { nomeRecebedor: 'João' } }).expect(200);
    expect(await comprovantes(rota.id)).toEqual([
      expect.objectContaining({ nomeRecebedor: 'João', assinatura: null, fotoUrl: null }),
    ]);
  });

  it('repetir o comando com a mesma chave não duplica o comprovante nem deixa foto sobrando', async () => {
    const { rota, servicoId } = await noLocal();
    const chave = randomUUID();
    const corpo = { comprovante: { fotoJpegBase64: JPEG_MINIMO } };
    await comando(`servicos/${servicoId}/realizar`, corpo, chave).expect(200);
    await comando(`servicos/${servicoId}/realizar`, corpo, chave).expect(200);
    expect(await comprovantes(rota.id)).toHaveLength(1);
    expect(await arquivosDaRota(rota.id)).toHaveLength(1);
  });

  it('serviço já realizado: comprovante enviado depois é ignorado e a foto não fica gravada', async () => {
    const { rota, servicoId } = await noLocal();
    await comando(`servicos/${servicoId}/realizar`).expect(200);
    await comando(`servicos/${servicoId}/realizar`, { comprovante: { fotoJpegBase64: JPEG_MINIMO } }).expect(200);
    expect(await comprovantes(rota.id)).toEqual([]);
    expect(await arquivosDaRota(rota.id)).toEqual([]);
  });

  it('foto que não é JPEG ou comprovante vazio é 400 e o serviço continua pendente', async () => {
    const { rota, servicoId } = await noLocal();
    const png = await comando(`servicos/${servicoId}/realizar`, { comprovante: { fotoJpegBase64: PNG } }).expect(400);
    expect(codigo(png.body)).toBe('VALIDACAO');
    await comando(`servicos/${servicoId}/realizar`, { comprovante: {} }).expect(400);
    const servico = await prisma.servico.findUniqueOrThrow({ where: { id: servicoId } });
    expect(servico.status).toBe('PENDENTE');
    expect(await arquivosDaRota(rota.id)).toEqual([]);
  });

  it('só o admin lista os comprovantes', async () => {
    const { rota } = await noLocal();
    await api().get(`/api/v1/rotas/${rota.id}/comprovantes`).expect(401);
    await api()
      .get(`/api/v1/rotas/${rota.id}/comprovantes`)
      .set('Authorization', `Bearer ${motorista.accessToken}`)
      .expect(403);
  });
});

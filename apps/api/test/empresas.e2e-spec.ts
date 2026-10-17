import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { empresaSchema, respostaErroSchema } from '@rotas/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { carregarEnv } from '../src/config/env.js';
import { configurarApp } from '../src/configurar-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const respostaPaginadaEmpresasSchema = z.object({
  itens: z.array(empresaSchema),
  total: z.number(),
  pagina: z.number(),
  porPagina: z.number(),
});

const payloadBase = {
  nomeFantasia: '  Mercado São Jorge  ',
  razaoSocial: ' Mercado São Jorge Ltda ',
  documento: '12.345.678/0001-90',
  telefone: '(11) 98765-4321',
  whatsapp: '(11) 91234-5678',
  logradouro: 'Rua São Bento',
  numero: '100',
  complemento: 'Loja 2',
  bairro: 'Centro',
  cidade: 'São Paulo',
  uf: 'sp',
  cep: '01011-100',
  latitude: -23.55052,
  longitude: -46.633309,
  responsavel: 'Carlos Silva',
  horarioFuncionamento: '08:00 às 18:00',
  observacoes: 'Entrada lateral',
};

describe('Empresas (e2e)', () => {
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
    await prisma.$executeRaw`TRUNCATE empresas CASCADE`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/empresas cria empresa normalizada, mascara documento e omite campos internos', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/empresas').send(payloadBase).expect(201);

    const corpo = empresaSchema.parse(res.body);
    expect(corpo.nomeFantasia).toBe('Mercado São Jorge');
    expect(corpo.documentoMascarado).toBe('**.345.678/0001-**');
    expect(corpo.telefone).toBe('+5511987654321');
    expect(corpo.whatsapp).toBe('+5511912345678');
    expect(corpo.uf).toBe('SP');
    expect(corpo.cep).toBe('01011100');
    expect(corpo.enderecoFormatado).toBe('Rua São Bento, 100 – Centro, São Paulo – SP, 01011-100');
    expect(corpo.fonteLocalizacao).toBe('MANUAL');
    expect(corpo.arquivadaEm).toBeNull();
    expect(res.body).not.toHaveProperty('documento');
    expect(res.body).not.toHaveProperty('precisaoLocalizacao');
    expect(res.body).not.toHaveProperty('localizacaoAtualizadaEm');

    const gravada = await prisma.empresa.findUnique({ where: { id: corpo.id } });
    expect(gravada?.documento).toBe('12345678000190');
    expect(gravada?.precisaoLocalizacao).toBe('EXATA');
    expect(gravada?.localizacaoAtualizadaEm).toBeInstanceOf(Date);
  });

  it('POST /api/v1/empresas retorna 400 VALIDACAO com detalhes em dados inválidos', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/empresas')
      .send({ ...payloadBase, telefone: 'invalido', longitude: undefined })
      .expect(400);

    const erro = respostaErroSchema.parse(res.body);
    expect(erro.erro.codigo).toBe('VALIDACAO');
    expect(erro.erro.detalhes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ caminho: 'telefone', mensagem: 'Telefone inválido.' }),
      ]),
    );
  });

  it('POST /api/v1/empresas retorna 400 VALIDACAO quando recebe campo extra', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/empresas')
      .send({ ...payloadBase, campoNaoPermitido: true })
      .expect(400);

    expect(respostaErroSchema.parse(res.body).erro.codigo).toBe('VALIDACAO');
  });

  it('POST /api/v1/empresas retorna 409 REGISTRO_DUPLICADO para documento duplicado entre ativas', async () => {
    await request(app.getHttpServer()).post('/api/v1/empresas').send(payloadBase).expect(201);

    const resDuplicada = await request(app.getHttpServer())
      .post('/api/v1/empresas')
      .send({ ...payloadBase, nomeFantasia: 'Outra Empresa' })
      .expect(409);

    expect(respostaErroSchema.parse(resDuplicada.body).erro.codigo).toBe('REGISTRO_DUPLICADO');
  });

  it('GET /api/v1/empresas omite arquivadas por padrão e as inclui com incluirArquivadas=true', async () => {
    const resB = await request(app.getHttpServer())
      .post('/api/v1/empresas')
      .send({ ...payloadBase, nomeFantasia: 'Bazar Paulista', documento: undefined })
      .expect(201);
    const empresaB = empresaSchema.parse(resB.body);

    await request(app.getHttpServer())
      .post('/api/v1/empresas')
      .send({ ...payloadBase, nomeFantasia: 'Armazém Campinas', documento: undefined })
      .expect(201);

    await request(app.getHttpServer()).post(`/api/v1/empresas/${empresaB.id}/arquivar`).expect(200);

    const listaAtivas = await request(app.getHttpServer()).get('/api/v1/empresas').expect(200);
    const paginadaAtivas = respostaPaginadaEmpresasSchema.parse(listaAtivas.body);
    expect(paginadaAtivas.total).toBe(1);
    expect(paginadaAtivas.itens.map((i) => i.nomeFantasia)).toEqual(['Armazém Campinas']);

    const listaTodas = await request(app.getHttpServer())
      .get('/api/v1/empresas')
      .query({ incluirArquivadas: 'true' })
      .expect(200);
    const paginadaTodas = respostaPaginadaEmpresasSchema.parse(listaTodas.body);
    expect(paginadaTodas.total).toBe(2);
    expect(paginadaTodas.itens.map((i) => i.nomeFantasia)).toEqual(['Armazém Campinas', 'Bazar Paulista']);
  });

  it('GET /api/v1/empresas filtra por busca em nomeFantasia, bairro ou cidade sem diferenciar maiúsculas', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/empresas')
      .send({ ...payloadBase, nomeFantasia: 'Bazar Paulista', documento: undefined, bairro: 'Mooca' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/empresas')
      .send({
        ...payloadBase,
        nomeFantasia: 'Armazém Campinas',
        documento: undefined,
        bairro: 'Cambuí',
        cidade: 'Campinas',
      })
      .expect(201);

    const buscaCidade = await request(app.getHttpServer())
      .get('/api/v1/empresas')
      .query({ busca: 'CAMPINAS' })
      .expect(200);
    const resultado = respostaPaginadaEmpresasSchema.parse(buscaCidade.body);
    expect(resultado.total).toBe(1);
    expect(resultado.itens[0]?.nomeFantasia).toBe('Armazém Campinas');
  });

  it('GET /api/v1/empresas pagina duas empresas com o mesmo nome sem repetir nem pular com porPagina=1', async () => {
    const primeira = empresaSchema.parse(
      (
        await request(app.getHttpServer())
          .post('/api/v1/empresas')
          .send({ ...payloadBase, nomeFantasia: 'Rede Mesmo Nome', documento: undefined })
          .expect(201)
      ).body,
    );
    const segunda = empresaSchema.parse(
      (
        await request(app.getHttpServer())
          .post('/api/v1/empresas')
          .send({ ...payloadBase, nomeFantasia: 'Rede Mesmo Nome', documento: undefined })
          .expect(201)
      ).body,
    );

    const pag1 = respostaPaginadaEmpresasSchema.parse(
      (await request(app.getHttpServer()).get('/api/v1/empresas').query({ pagina: '1', porPagina: '1' }).expect(200))
        .body,
    );
    const pag2 = respostaPaginadaEmpresasSchema.parse(
      (await request(app.getHttpServer()).get('/api/v1/empresas').query({ pagina: '2', porPagina: '1' }).expect(200))
        .body,
    );

    expect(pag1.total).toBe(2);
    expect(pag2.total).toBe(2);
    const idsPaginados = [pag1.itens[0]?.id, pag2.itens[0]?.id];
    expect(idsPaginados).toEqual([primeira.id, segunda.id].sort());
  });

  it('GET /api/v1/empresas/:id retorna 404 NAO_ENCONTRADO quando a empresa não existe', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/empresas/00000000-0000-4000-8000-000000000000')
      .expect(404);

    expect(respostaErroSchema.parse(res.body).erro.codigo).toBe('NAO_ENCONTRADO');
  });

  it('GET /api/v1/empresas/:id retorna empresa mesmo quando arquivada', async () => {
    const criada = empresaSchema.parse(
      (await request(app.getHttpServer()).post('/api/v1/empresas').send(payloadBase).expect(201)).body,
    );
    await request(app.getHttpServer()).post(`/api/v1/empresas/${criada.id}/arquivar`).expect(200);

    const detalhe = await request(app.getHttpServer()).get(`/api/v1/empresas/${criada.id}`).expect(200);
    expect(empresaSchema.parse(detalhe.body).arquivadaEm).not.toBeNull();
  });

  it('PATCH /api/v1/empresas/:id edita endereço mantendo coordenadas existentes', async () => {
    const criada = empresaSchema.parse(
      (await request(app.getHttpServer()).post('/api/v1/empresas').send(payloadBase).expect(201)).body,
    );

    const editada = empresaSchema.parse(
      (
        await request(app.getHttpServer())
          .patch(`/api/v1/empresas/${criada.id}`)
          .send({ logradouro: 'Av. Paulista', numero: '1000' })
          .expect(200)
      ).body,
    );
    expect(editada.logradouro).toBe('Av. Paulista');
    expect(editada.numero).toBe('1000');
    expect(editada.latitude).toBe(-23.55052);
    expect(editada.longitude).toBe(-46.633309);
  });

  it('PATCH /api/v1/empresas/:id com string vazia apaga o complemento', async () => {
    const criada = empresaSchema.parse(
      (await request(app.getHttpServer()).post('/api/v1/empresas').send(payloadBase).expect(201)).body,
    );
    expect(criada.complemento).toBe('Loja 2');

    const editada = empresaSchema.parse(
      (
        await request(app.getHttpServer())
          .patch(`/api/v1/empresas/${criada.id}`)
          .send({ complemento: '' })
          .expect(200)
      ).body,
    );
    expect(editada.complemento).toBeNull();
  });

  it('PATCH /api/v1/empresas/:id com null apaga o documento', async () => {
    const criada = empresaSchema.parse(
      (await request(app.getHttpServer()).post('/api/v1/empresas').send(payloadBase).expect(201)).body,
    );
    expect(criada.documentoMascarado).toBe('**.345.678/0001-**');

    const editada = empresaSchema.parse(
      (
        await request(app.getHttpServer())
          .patch(`/api/v1/empresas/${criada.id}`)
          .send({ documento: null })
          .expect(200)
      ).body,
    );
    expect(editada.documentoMascarado).toBeNull();
  });

  it('PATCH /api/v1/empresas/:id retorna 422 REGRA_NEGOCIO para empresa arquivada', async () => {
    const criada = empresaSchema.parse(
      (await request(app.getHttpServer()).post('/api/v1/empresas').send(payloadBase).expect(201)).body,
    );
    await request(app.getHttpServer()).post(`/api/v1/empresas/${criada.id}/arquivar`).expect(200);

    const resArquivada = await request(app.getHttpServer())
      .patch(`/api/v1/empresas/${criada.id}`)
      .send({ nomeFantasia: 'Tentativa' })
      .expect(422);
    expect(respostaErroSchema.parse(resArquivada.body).erro.codigo).toBe('REGRA_NEGOCIO');
  });

  it('POST /api/v1/empresas/:id/arquivar grava arquivadaEm e é idempotente ao repetir', async () => {
    const criada = empresaSchema.parse(
      (await request(app.getHttpServer()).post('/api/v1/empresas').send(payloadBase).expect(201)).body,
    );

    const arq1 = empresaSchema.parse(
      (await request(app.getHttpServer()).post(`/api/v1/empresas/${criada.id}/arquivar`).expect(200)).body,
    );
    const arq2 = empresaSchema.parse(
      (await request(app.getHttpServer()).post(`/api/v1/empresas/${criada.id}/arquivar`).expect(200)).body,
    );
    expect(arq1.arquivadaEm).not.toBeNull();
    expect(arq2.arquivadaEm).toBe(arq1.arquivadaEm);
  });

  it('POST /api/v1/empresas/:id/reativar retorna 409 REGISTRO_DUPLICADO quando documento conflita com outra ativa', async () => {
    const primeira = empresaSchema.parse(
      (await request(app.getHttpServer()).post('/api/v1/empresas').send(payloadBase).expect(201)).body,
    );
    await request(app.getHttpServer()).post(`/api/v1/empresas/${primeira.id}/arquivar`).expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/empresas')
      .send({ ...payloadBase, nomeFantasia: 'Nova Ativa Mesmo CNPJ' })
      .expect(201);

    const resConflito = await request(app.getHttpServer())
      .post(`/api/v1/empresas/${primeira.id}/reativar`)
      .expect(409);
    expect(respostaErroSchema.parse(resConflito.body).erro.codigo).toBe('REGISTRO_DUPLICADO');
  });
});

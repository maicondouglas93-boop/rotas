import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { respostaErroSchema } from '@rotas/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { carregarEnv } from '../src/config/env.js';
import { configurarApp } from '../src/configurar-app.js';

describe('Saúde e envelope de erro (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurarApp(app, carregarEnv());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/saude responde sem tocar no banco', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/saude').expect(200);
    expect(res.body).toEqual({ status: 'ok', versao: expect.any(String) });
  });

  it('GET /api/v1/saude/pronto confirma o banco', async () => {
    await request(app.getHttpServer()).get('/api/v1/saude/pronto').expect(200);
  });

  it('rota inexistente devolve o envelope NAO_ENCONTRADO com requestId', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/nao-existe')
      .set('x-request-id', 'teste-request-id-123')
      .expect(404);
    const corpo = respostaErroSchema.parse(res.body);
    expect(corpo.erro.codigo).toBe('NAO_ENCONTRADO');
    expect(corpo.erro.requestId).toBe('teste-request-id-123');
    expect(res.headers['x-request-id']).toBe('teste-request-id-123');
  });

  it('gera requestId quando o recebido tem formato inseguro', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/saude').set('x-request-id', '<script>');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('aplica cabeçalhos de segurança do helmet', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/saude');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { payloadTempoRealSchema, rotaSchema, type Rota } from '@rotas/shared';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { carregarEnv } from '../src/config/env.js';
import { configurarApp } from '../src/configurar-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { autenticarAdminTeste, autenticarMotoristaTeste, limparBancoTeste } from './apoio/autenticacao.js';

type MotoristaTeste = Awaited<ReturnType<typeof autenticarMotoristaTeste>>;

const ESPERA_MS = 3000;
const SILENCIO_MS = 300;

describe('Tempo real (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let url: string;
  let tokenAdmin: string;
  let motorista: MotoristaTeste;
  let outroMotorista: MotoristaTeste;
  const abertos: Socket[] = [];

  const api = () => request(app.getHttpServer());
  const comoAdmin = <T extends request.Test>(req: T) => req.set('Authorization', `Bearer ${tokenAdmin}`);

  function conectar(token?: string): Promise<Socket> {
    const socket = io(url, {
      auth: token === undefined ? {} : { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    abertos.push(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', (erro) => reject(erro));
    });
  }

  function esperarEvento(socket: Socket, evento: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const limite = setTimeout(() => reject(new Error(`evento ${evento} não chegou`)), ESPERA_MS);
      socket.once(evento, (payload: unknown) => {
        clearTimeout(limite);
        resolve(payloadTempoRealSchema.parse(payload));
      });
    });
  }

  function registrarTudo(socket: Socket): string[] {
    const recebidos: string[] = [];
    socket.onAny((evento: string) => recebidos.push(evento));
    return recebidos;
  }

  const silencio = () => new Promise((resolve) => setTimeout(resolve, SILENCIO_MS));

  async function criarRota(m: MotoristaTeste): Promise<Rota> {
    const empresa = await prisma.empresa.create({
      data: {
        nomeFantasia: `Empresa ${randomUUID().slice(0, 8)}`,
        telefone: '+5511987654321',
        logradouro: 'Rua A',
        numero: '1',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '01011100',
      },
    });
    const res = await comoAdmin(api().post('/api/v1/rotas'))
      .send({
        nome: 'Rota ao vivo',
        dataPrevista: '2026-10-20',
        motoristaId: m.motorista.id,
        paradas: [{ empresaId: empresa.id, servicos: ['ENTREGA'] }],
      })
      .expect(201);
    return rotaSchema.parse(res.body);
  }

  async function enviar(rota: Rota): Promise<Rota> {
    const res = await comoAdmin(api().post(`/api/v1/rotas/${rota.id}/enviar`)).send({ versao: rota.versao }).expect(200);
    return rotaSchema.parse(res.body);
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurarApp(app, carregarEnv());
    await app.listen(0);
    const { port } = (app.getHttpServer() as unknown as Server).address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await limparBancoTeste(prisma);
    tokenAdmin = (await autenticarAdminTeste(app, prisma)).accessToken;
    motorista = await autenticarMotoristaTeste(app, prisma);
    outroMotorista = await autenticarMotoristaTeste(app, prisma);
  });

  afterEach(() => {
    for (const socket of abertos.splice(0)) socket.disconnect();
  });

  afterAll(async () => {
    await app.close();
  });

  it('recusa conexão sem token ou com token inválido', async () => {
    await expect(conectar()).rejects.toThrow('NAO_AUTENTICADO');
    await expect(conectar('nao-e-um-jwt')).rejects.toThrow('NAO_AUTENTICADO');
  });

  it('admin e o motorista da rota recebem os eventos depois do commit; outro motorista não', async () => {
    const admin = await conectar(tokenAdmin);
    const dono = await conectar(motorista.accessToken);
    const intruso = await conectar(outroMotorista.accessToken);
    const doIntruso = registrarTudo(intruso);

    const rascunho = await criarRota(motorista);
    const enviadaAdmin = esperarEvento(admin, 'rota.enviada');
    const enviadaDono = esperarEvento(dono, 'rota.enviada');
    const enviada = await enviar(rascunho);
    expect(await enviadaAdmin).toEqual({ rotaId: enviada.id, status: 'ENVIADA', versao: enviada.versao });
    expect(await enviadaDono).toMatchObject({ rotaId: enviada.id, status: 'ENVIADA' });

    const recebida = esperarEvento(admin, 'rota.recebida');
    await api()
      .post(`/api/v1/motorista/rotas/${enviada.id}/confirmar-recebimento`)
      .set('Authorization', `Bearer ${motorista.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(200);
    expect(await recebida).toMatchObject({ rotaId: enviada.id, status: 'RECEBIDA' });

    await silencio();
    expect(doIntruso).toEqual([]);
  });

  it('rascunho só avisa o admin e comando recusado não publica nada', async () => {
    const admin = await conectar(tokenAdmin);
    const dono = await conectar(motorista.accessToken);
    const doDono = registrarTudo(dono);

    const criada = esperarEvento(admin, 'rota.criada');
    const rascunho = await criarRota(motorista);
    expect(await criada).toMatchObject({ rotaId: rascunho.id, status: 'RASCUNHO' });

    const doAdmin = registrarTudo(admin);
    await comoAdmin(api().post(`/api/v1/rotas/${rascunho.id}/enviar`)).send({ versao: rascunho.versao + 5 }).expect(409);
    await silencio();
    expect(doAdmin).toEqual([]);
    expect(doDono).toEqual([]);
  });

  it('avisa a exclusão do rascunho', async () => {
    const admin = await conectar(tokenAdmin);
    const rascunho = await criarRota(motorista);
    const excluida = esperarEvento(admin, 'rota.excluida');
    await comoAdmin(api().delete(`/api/v1/rotas/${rascunho.id}?versao=${rascunho.versao}`)).expect(204);
    expect(await excluida).toEqual({ rotaId: rascunho.id });
  });

  it('derruba a conexão quando o access token vence', async () => {
    // Mesmo usuário e sessão do admin, com validade de 1 segundo.
    const [, corpo] = tokenAdmin.split('.');
    const { sub, perfil, sid } = JSON.parse(Buffer.from(corpo!, 'base64url').toString('utf8')) as Record<string, string>;
    const curto = await app
      .get(JwtService, { strict: false })
      .signAsync({ sub, perfil, sid }, { algorithm: 'HS256', secret: carregarEnv().JWT_SECRET, expiresIn: 1 });

    const socket = await conectar(curto);
    const motivo = await new Promise<string>((resolve) => socket.once('disconnect', resolve));
    expect(motivo).toBe('io server disconnect');
  });
});

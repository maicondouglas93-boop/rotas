import { createHmac } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { CodigoErro } from '@rotas/shared';
import type { Env } from '../../config/env.js';
import { TokensService } from './tokens.service.js';

const envBase: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  DATABASE_URL: 'postgresql://rotas:rotas_dev@localhost:5432/rotas_test',
  CORS_ORIGENS: ['http://localhost:3000'],
  LOG_LEVEL: 'error',
  JWT_SECRET: 'segredo-jwt-unitario-com-pelo-menos-32-caracteres',
  JWT_ACCESS_MINUTOS: 15,
  REFRESH_DIAS: 30,
  COOKIE_DOMINIO: undefined,
  LIMITE_LOGIN_POR_MINUTO: 5,
  ARMAZENAMENTO_PASTA: '.armazenamento',
};

const USUARIO_ID = '00000000-0000-4000-8000-000000000010';
const MOTORISTA_ID = '00000000-0000-4000-8000-000000000020';
const FAMILIA_ID = '00000000-0000-4000-8000-000000000030';

describe('TokensService', () => {
  const jwt = new JwtService();
  const servico = new TokensService(jwt, envBase);

  it('assina e verifica access token de ADMIN sem mid e sem dados pessoais', async () => {
    const emitido = await servico.emitirAccessToken({
      usuarioId: USUARIO_ID,
      perfil: 'ADMIN',
      motoristaId: null,
      familiaId: FAMILIA_ID,
    });

    expect(emitido.expiraEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const payload = await servico.verificarAccessToken(emitido.accessToken);
    expect(payload).toEqual({
      sub: USUARIO_ID,
      perfil: 'ADMIN',
      sid: FAMILIA_ID,
      exp: expect.any(Number),
    });
    expect(payload.mid).toBeUndefined();
    // `exp` (usado para derrubar o socket quando o token vence) bate com a validade devolvida.
    expect(Math.abs(payload.exp! * 1000 - new Date(emitido.expiraEm).getTime())).toBeLessThanOrEqual(1000);
  });

  it('inclui mid quando o usuário é MOTORISTA', async () => {
    const emitido = await servico.emitirAccessToken({
      usuarioId: USUARIO_ID,
      perfil: 'MOTORISTA',
      motoristaId: MOTORISTA_ID,
      familiaId: FAMILIA_ID,
    });

    const payload = await servico.verificarAccessToken(emitido.accessToken);
    expect(payload).toEqual({
      sub: USUARIO_ID,
      perfil: 'MOTORISTA',
      mid: MOTORISTA_ID,
      sid: FAMILIA_ID,
      exp: expect.any(Number),
    });
  });

  it('rejeita token assinado com outra chave', async () => {
    const tokenOutraChave = await jwt.signAsync(
      { sub: USUARIO_ID, perfil: 'ADMIN', sid: FAMILIA_ID },
      {
        algorithm: 'HS256',
        secret: 'outra-chave-secreta-diferente-com-32-caracteres',
        expiresIn: 60,
      },
    );

    await expect(servico.verificarAccessToken(tokenOutraChave)).rejects.toMatchObject({
      codigo: CodigoErro.NAO_AUTENTICADO,
      status: 401,
    });
  });

  it('rejeita token expirado', async () => {
    const tokenExpirado = await jwt.signAsync(
      { sub: USUARIO_ID, perfil: 'ADMIN', sid: FAMILIA_ID },
      {
        algorithm: 'HS256',
        secret: envBase.JWT_SECRET,
        expiresIn: -10,
      },
    );

    await expect(servico.verificarAccessToken(tokenExpirado)).rejects.toMatchObject({
      codigo: CodigoErro.NAO_AUTENTICADO,
      status: 401,
    });
  });

  it('rejeita token com algoritmo diferente de HS256 (ex.: HS384 ou none)', async () => {
    const tokenHs384 = await jwt.signAsync(
      { sub: USUARIO_ID, perfil: 'ADMIN', sid: FAMILIA_ID },
      {
        algorithm: 'HS384',
        secret: envBase.JWT_SECRET,
        expiresIn: 60,
      },
    );

    await expect(servico.verificarAccessToken(tokenHs384)).rejects.toMatchObject({
      codigo: CodigoErro.NAO_AUTENTICADO,
      status: 401,
    });

    const cabecalhoNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
      'base64url',
    );
    const corpoToken = Buffer.from(
      JSON.stringify({ sub: USUARIO_ID, perfil: 'ADMIN', sid: FAMILIA_ID }),
    ).toString('base64url');
    const assinatura = createHmac('sha256', envBase.JWT_SECRET)
      .update(`${cabecalhoNone}.${corpoToken}`)
      .digest('base64url');

    await expect(
      servico.verificarAccessToken(`${cabecalhoNone}.${corpoToken}.${assinatura}`),
    ).rejects.toMatchObject({
      codigo: CodigoErro.NAO_AUTENTICADO,
      status: 401,
    });
  });

  it('gera refresh token opaco em base64url (32 bytes) e calcula SHA-256 hex', () => {
    const r1 = servico.gerarRefreshToken();
    const r2 = servico.gerarRefreshToken();

    expect(r1.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r1.token).not.toBe(r2.token);
    expect(r1.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r1.tokenHash).not.toBe(r1.token);
    expect(servico.hashRefreshToken(r1.token)).toBe(r1.tokenHash);
  });
});

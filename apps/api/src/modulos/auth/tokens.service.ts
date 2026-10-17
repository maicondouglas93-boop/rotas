import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { perfilUsuarioSchema, type PerfilUsuario } from '@rotas/shared';
import { z } from 'zod';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import { ENV, type Env } from '../../config/env.js';
import type { PayloadAccessToken } from './tipos.js';

const payloadAccessTokenSchema = z.object({
  sub: z.uuid(),
  perfil: perfilUsuarioSchema,
  mid: z.uuid().optional(),
  sid: z.uuid(),
  exp: z.number().int().optional(),
});

export interface DadosEmissaoAccessToken {
  usuarioId: string;
  perfil: PerfilUsuario;
  motoristaId: string | null;
  familiaId: string;
}

export interface AccessTokenEmitido {
  accessToken: string;
  expiraEm: string;
}

export interface RefreshTokenGerado {
  token: string;
  tokenHash: string;
  expiraEm: Date;
}

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async emitirAccessToken(dados: DadosEmissaoAccessToken): Promise<AccessTokenEmitido> {
    const validadeSegundos = this.env.JWT_ACCESS_MINUTOS * 60;
    const expiraEm = new Date(Date.now() + validadeSegundos * 1000).toISOString();

    const payload: PayloadAccessToken = {
      sub: dados.usuarioId,
      perfil: dados.perfil,
      ...(dados.motoristaId ? { mid: dados.motoristaId } : {}),
      sid: dados.familiaId,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      algorithm: 'HS256',
      secret: this.env.JWT_SECRET,
      expiresIn: validadeSegundos,
    });

    return { accessToken, expiraEm };
  }

  async verificarAccessToken(token: string): Promise<PayloadAccessToken> {
    // Rejeita tokens cujo cabeçalho não declare explicitamente HS256.
    const partes = token.split('.');
    if (partes.length !== 3 || !partes[0]) {
      throw ErroDominio.naoAutenticado();
    }

    try {
      const cabecalhoJson = Buffer.from(partes[0], 'base64url').toString('utf8');
      const cabecalho = JSON.parse(cabecalhoJson) as { alg?: unknown };
      if (cabecalho.alg !== 'HS256') {
        throw ErroDominio.naoAutenticado();
      }

      const bruto = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        algorithms: ['HS256'],
        secret: this.env.JWT_SECRET,
      });

      const validado = payloadAccessTokenSchema.safeParse(bruto);
      if (!validado.success) {
        throw ErroDominio.naoAutenticado();
      }
      return validado.data;
    } catch (erro) {
      if (erro instanceof ErroDominio) {
        throw erro;
      }
      throw ErroDominio.naoAutenticado();
    }
  }

  gerarRefreshToken(): RefreshTokenGerado {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashRefreshToken(token);
    const expiraEm = new Date(Date.now() + this.env.REFRESH_DIAS * 24 * 60 * 60 * 1000);
    return { token, tokenHash, expiraEm };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}

import { Module, type ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { normalizeIp, ThrottlerModule } from '@nestjs/throttler';
import { ENV, type Env } from '../../config/env.js';
import { AutenticacaoGuard } from './autenticacao.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PerfisGuard } from './perfis.guard.js';
import { SenhasService } from './senhas.service.js';
import { TokensService } from './tokens.service.js';

const UM_MINUTO_MS = 60_000;
const TETO_IP_LOGIN_POR_MINUTO = 60;

export function rastrearIpEEmail(req: Record<string, unknown>): string {
  const ipBruto = typeof req['ip'] === 'string' ? req['ip'] : '';
  const ip = normalizeIp(ipBruto);
  const corpo = req['body'];
  const emailBruto =
    typeof corpo === 'object' && corpo !== null
      ? (corpo as Record<string, unknown>)['email']
      : undefined;
  const email =
    typeof emailBruto === 'string' ? emailBruto.trim().toLowerCase().slice(0, 254) : '';
  return `${ip}:${email}`;
}

@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => [
        {
          name: 'default',
          ttl: UM_MINUTO_MS,
          limit: TETO_IP_LOGIN_POR_MINUTO,
        },
        {
          name: 'login_conta',
          ttl: UM_MINUTO_MS,
          limit: env.LIMITE_LOGIN_POR_MINUTO,
          skipIf: (contexto: ExecutionContext) => contexto.getHandler().name !== 'login',
          getTracker: (req: Record<string, unknown>) => rastrearIpEEmail(req),
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SenhasService,
    TokensService,
    { provide: APP_GUARD, useClass: AutenticacaoGuard },
    { provide: APP_GUARD, useClass: PerfisGuard },
  ],
  exports: [AuthService, SenhasService, TokensService],
})
export class AuthModule {}

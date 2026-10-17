import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  loginSchema,
  trocarSenhaSchema,
  type LoginEntrada,
  type Sessao,
  type TrocarSenhaEntrada,
  type UsuarioSessao,
} from '@rotas/shared';
import type { Request, Response } from 'express';
import { ZodPipe } from '../../comum/pipes/zod.pipe.js';
import { AuthService } from './auth.service.js';
import { Perfis, PermitirSenhaTemporaria, Publico, UsuarioAtual } from './decoradores.js';
import type { UsuarioAutenticado } from './tipos.js';

const UM_MINUTO_MS = 60_000;
const LIMITE_PADRAO_AUTH_POR_MINUTO = 30;

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Publico()
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new ZodPipe(loginSchema)) dados: LoginEntrada,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Sessao> {
    return this.auth.login(dados, req, res);
  }

  @Post('refresh')
  @Publico()
  @SkipThrottle({ login_conta: true })
  @Throttle({ default: { limit: LIMITE_PADRAO_AUTH_POR_MINUTO, ttl: UM_MINUTO_MS } })
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body() corpoBruto: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Sessao> {
    return this.auth.refresh(corpoBruto, req, res);
  }

  @Post('logout')
  @Publico()
  @SkipThrottle({ login_conta: true })
  @Throttle({ default: { limit: LIMITE_PADRAO_AUTH_POR_MINUTO, ttl: UM_MINUTO_MS } })
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(
    @Body() corpoBruto: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    return this.auth.logout(corpoBruto, req, res);
  }

  @Post('trocar-senha')
  @Perfis('ADMIN', 'MOTORISTA')
  @PermitirSenhaTemporaria()
  @SkipThrottle({ login_conta: true })
  @Throttle({ default: { limit: LIMITE_PADRAO_AUTH_POR_MINUTO, ttl: UM_MINUTO_MS } })
  @HttpCode(HttpStatus.NO_CONTENT)
  trocarSenha(
    @Body(new ZodPipe(trocarSenhaSchema)) dados: TrocarSenhaEntrada,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.auth.trocarSenha(dados, usuario);
  }

  @Get('eu')
  @Perfis('ADMIN', 'MOTORISTA')
  @PermitirSenhaTemporaria()
  @SkipThrottle({ default: true, login_conta: true })
  eu(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<UsuarioSessao> {
    return this.auth.eu(usuario);
  }
}

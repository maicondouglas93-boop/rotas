import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CHAVE_PERMITIR_SENHA_TEMPORARIA, CHAVE_PUBLICO } from './decoradores.js';
import { TokensService } from './tokens.service.js';

@Injectable()
export class AutenticacaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publico) {
      return true;
    }

    const req = contexto.switchToHttp().getRequest<Request>();
    const token = extrairTokenBearer(req);
    if (!token) {
      throw ErroDominio.naoAutenticado();
    }

    const payload = await this.tokens.verificarAccessToken(token);
    const agora = new Date();

    // Consulta única para validar que o usuário segue ativo e a família da sessão não foi revogada.
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        id: payload.sub,
        ativo: true,
        sessoes: {
          some: {
            familiaId: payload.sid,
            revogadaEm: null,
            expiraEm: { gt: agora },
          },
        },
      },
      select: {
        id: true,
        perfil: true,
        deveTrocarSenha: true,
        motorista: {
          select: {
            id: true,
            desativadoEm: true,
          },
        },
      },
    });

    if (!usuario) {
      throw ErroDominio.naoAutenticado();
    }

    if (
      usuario.perfil === 'MOTORISTA' &&
      (!usuario.motorista || usuario.motorista.desativadoEm !== null)
    ) {
      throw ErroDominio.naoAutenticado();
    }

    if (usuario.deveTrocarSenha) {
      const permitirTemporaria = this.reflector.getAllAndOverride<boolean>(
        CHAVE_PERMITIR_SENHA_TEMPORARIA,
        [contexto.getHandler(), contexto.getClass()],
      );
      if (!permitirTemporaria) {
        throw ErroDominio.trocaSenhaObrigatoria('Troque sua senha para continuar.');
      }
    }

    req.usuario = {
      usuarioId: usuario.id,
      perfil: usuario.perfil,
      motoristaId: usuario.motorista?.id ?? null,
      sessaoId: payload.sid,
    };

    return true;
  }
}

function extrairTokenBearer(req: Request): string | null {
  const cabecalho = req.header('authorization');
  if (!cabecalho) return null;
  const [esquema, token, ...resto] = cabecalho.trim().split(/\s+/);
  if (!esquema || esquema.toLowerCase() !== 'bearer' || !token || resto.length > 0) {
    return null;
  }
  return token;
}

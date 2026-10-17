import { Injectable } from '@nestjs/common';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UsuarioAutenticado } from './tipos.js';
import { TokensService } from './tokens.service.js';

export interface AcessoValidado {
  usuario: UsuarioAutenticado;
  deveTrocarSenha: boolean;
  /** Fim da validade do access token; `null` se o token não informar `exp`. */
  expiraEm: Date | null;
}

/** Validação do access token usada pelo guard HTTP e pelo handshake do Socket.IO. */
@Injectable()
export class AcessoService {
  constructor(
    private readonly tokens: TokensService,
    private readonly prisma: PrismaService,
  ) {}

  async validar(token: string): Promise<AcessoValidado> {
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

    if (usuario.perfil === 'MOTORISTA' && (!usuario.motorista || usuario.motorista.desativadoEm !== null)) {
      throw ErroDominio.naoAutenticado();
    }

    return {
      usuario: {
        usuarioId: usuario.id,
        perfil: usuario.perfil,
        motoristaId: usuario.motorista?.id ?? null,
        sessaoId: payload.sid,
      },
      deveTrocarSenha: usuario.deveTrocarSenha,
      expiraEm: payload.exp ? new Date(payload.exp * 1000) : null,
    };
  }
}

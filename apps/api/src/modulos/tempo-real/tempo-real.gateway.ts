import { Logger } from '@nestjs/common';
import { WebSocketGateway, type OnGatewayConnection, type OnGatewayInit } from '@nestjs/websockets';
import { MOTIVO_TEMPO_REAL_NAO_AUTENTICADO } from '@rotas/shared';
import type { Server, Socket } from 'socket.io';
import { AcessoService } from '../auth/acesso.service.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { SALA_ADMIN, salaMotorista, TempoRealService } from './tempo-real.service.js';

interface DadosSocket {
  usuario: UsuarioAutenticado;
  expiraEm: Date | null;
}

/** Maior atraso aceito pelo setTimeout (≈ 24,8 dias); tokens de acesso vencem bem antes disso. */
const ATRASO_MAXIMO_MS = 2_147_483_647;

/**
 * Só avisa: nenhum evento enviado pelo cliente altera estado (comandos vão pelo REST).
 * O servidor escolhe a sala a partir do token; o cliente nunca escolhe (auth-security-lgpd).
 */
@WebSocketGateway()
export class TempoRealGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger('TempoReal');

  constructor(
    private readonly acesso: AcessoService,
    private readonly tempoReal: TempoRealService,
  ) {}

  afterInit(servidor: Server): void {
    this.tempoReal.vincular(servidor);
    servidor.use((socket, next) => {
      this.autenticar(socket).then(
        () => next(),
        () => next(new Error(MOTIVO_TEMPO_REAL_NAO_AUTENTICADO)),
      );
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const { usuario, expiraEm } = socket.data as DadosSocket;
    await socket.join(usuario.perfil === 'ADMIN' ? SALA_ADMIN : salaMotorista(usuario.motoristaId!));

    // Token vencido derruba a conexão; o cliente renova a sessão e reconecta com o token novo.
    if (expiraEm) {
      const atraso = Math.min(Math.max(expiraEm.getTime() - Date.now(), 0), ATRASO_MAXIMO_MS);
      const temporizador = setTimeout(() => socket.disconnect(true), atraso);
      socket.once('disconnect', () => clearTimeout(temporizador));
    }
  }

  private async autenticar(socket: Socket): Promise<void> {
    const auth: unknown = socket.handshake.auth;
    const token = typeof auth === 'object' && auth !== null ? (auth as Record<string, unknown>)['token'] : undefined;
    if (typeof token !== 'string' || token === '') throw new Error('sem token');

    const { usuario, deveTrocarSenha, expiraEm } = await this.acesso.validar(token);
    if (deveTrocarSenha) throw new Error('troca de senha pendente');
    if (usuario.perfil === 'MOTORISTA' && !usuario.motoristaId) throw new Error('motorista sem cadastro');
    socket.data = { usuario, expiraEm } satisfies DadosSocket;
    this.logger.debug(`Conectado: ${usuario.perfil} ${usuario.usuarioId}`);
  }
}

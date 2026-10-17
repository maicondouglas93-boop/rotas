import { Injectable, Logger } from '@nestjs/common';
import type { EventoTempoReal, PayloadTempoReal } from '@rotas/shared';
import type { Server } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { EventoColetado } from './coletor.js';

export const SALA_ADMIN = 'admin';
export const salaMotorista = (motoristaId: string) => `motorista:${motoristaId}`;

/** Único ponto que emite no Socket.IO: os demais módulos não injetam o `Server` (nestjs-backend). */
@Injectable()
export class TempoRealService {
  private readonly logger = new Logger('TempoReal');
  private servidor: Server | null = null;

  constructor(private readonly prisma: PrismaService) {}

  vincular(servidor: Server): void {
    this.servidor = servidor;
  }

  emitir(salas: string[], evento: EventoTempoReal, payload: PayloadTempoReal): void {
    if (!this.servidor || salas.length === 0) return;
    this.servidor.to(salas).emit(evento, payload);
  }

  /**
   * Publica os eventos anotados numa requisição, já com a transação confirmada.
   * Payload mínimo (ids, status e versão da rota); o cliente busca o detalhe pelo REST.
   */
  async publicar(eventos: EventoColetado[]): Promise<void> {
    if (!this.servidor || eventos.length === 0) return;
    try {
      const ids = [...new Set(eventos.map((e) => e.rotaId))];
      const rotas = await this.prisma.rota.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true, versao: true, motoristaId: true },
      });
      const porId = new Map(rotas.map((r) => [r.id, r]));

      for (const e of eventos) {
        const rota = porId.get(e.rotaId);
        const salas = [SALA_ADMIN];
        // Rascunho e rota excluída não interessam ao motorista.
        if (rota && rota.status !== 'RASCUNHO') {
          const motoristas = new Set([rota.motoristaId, ...e.motoristaIds].filter((id): id is string => !!id));
          for (const id of motoristas) salas.push(salaMotorista(id));
        }
        this.emitir(salas, e.evento, {
          rotaId: e.rotaId,
          ...(e.paradaId ? { paradaId: e.paradaId } : {}),
          ...(rota ? { status: rota.status, versao: rota.versao } : {}),
        });
      }
    } catch (erro) {
      // Falha no aviso não desfaz o comando: o cliente ainda recarrega ao focar a tela.
      this.logger.error(`Falha ao publicar eventos em tempo real: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  }
}

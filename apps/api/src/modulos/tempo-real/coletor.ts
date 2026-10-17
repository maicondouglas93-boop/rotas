import { AsyncLocalStorage } from 'node:async_hooks';
import type { EventoTempoReal } from '@rotas/shared';

/** Evento anotado durante a transação; só vai para o Socket.IO depois que a requisição termina bem. */
export interface EventoColetado {
  rotaId: string;
  evento: EventoTempoReal;
  paradaId?: string;
  /** Motoristas avisados além do dono atual da rota (ex.: o anterior, numa transferência). */
  motoristaIds: string[];
}

const coleta = new AsyncLocalStorage<EventoColetado[]>();

/** Roda `fn` com uma lista própria de eventos (uma por requisição HTTP). */
export function comColetaDeEventos<T>(eventos: EventoColetado[], fn: () => T): T {
  return coleta.run(eventos, fn);
}

/**
 * Anota um evento para publicar depois do commit. Fora de uma requisição (seed, testes de unidade)
 * não há coleta e o evento é ignorado.
 */
export function anotarEventoTempoReal(evento: EventoColetado): void {
  coleta.getStore()?.push(evento);
}

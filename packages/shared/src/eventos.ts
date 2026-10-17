import { z } from 'zod';
import type { TipoEventoRota } from './dominio/historico.js';
import { statusRotaSchema } from './dominio/status.js';

// Nomes de eventos Socket.IO no formato entidade.acao (skill architecture-guardian).
// Payload mínimo: ids e status; o cliente busca o detalhe via REST.
export const EventoTempoReal = {
  ROTA_CRIADA: 'rota.criada',
  ROTA_ENVIADA: 'rota.enviada',
  ROTA_EDITADA: 'rota.editada',
  ROTA_RECEBIDA: 'rota.recebida',
  ROTA_INICIADA: 'rota.iniciada',
  ROTA_CONCLUIDA: 'rota.concluida',
  ROTA_CANCELADA: 'rota.cancelada',
  ROTA_TRANSFERIDA: 'rota.transferida',
  ROTA_EXCLUIDA: 'rota.excluida',
  PARADA_A_CAMINHO: 'parada.a_caminho',
  PARADA_RETORNOU_FILA: 'parada.retornou_fila',
  PARADA_CHEGADA: 'parada.chegada',
  PARADA_FINALIZADA: 'parada.finalizada',
  PARADA_CANCELADA: 'parada.cancelada',
  SERVICO_REALIZADO: 'servico.realizado',
  SERVICO_NAO_REALIZADO: 'servico.nao_realizado',
  OCORRENCIA_REGISTRADA: 'ocorrencia.registrada',
} as const;
export type EventoTempoReal = (typeof EventoTempoReal)[keyof typeof EventoTempoReal];

/** Cada evento gravado no histórico da rota vira um evento em tempo real com o mesmo significado. */
export const EVENTO_TEMPO_REAL_DO_HISTORICO: Record<TipoEventoRota, EventoTempoReal> = {
  ROTA_CRIADA: EventoTempoReal.ROTA_CRIADA,
  ROTA_EDITADA: EventoTempoReal.ROTA_EDITADA,
  ROTA_ENVIADA: EventoTempoReal.ROTA_ENVIADA,
  ROTA_RECEBIDA: EventoTempoReal.ROTA_RECEBIDA,
  ROTA_INICIADA: EventoTempoReal.ROTA_INICIADA,
  ROTA_CONCLUIDA: EventoTempoReal.ROTA_CONCLUIDA,
  ROTA_CANCELADA: EventoTempoReal.ROTA_CANCELADA,
  ROTA_TRANSFERIDA: EventoTempoReal.ROTA_TRANSFERIDA,
  PARADA_A_CAMINHO: EventoTempoReal.PARADA_A_CAMINHO,
  PARADA_RETORNOU_FILA: EventoTempoReal.PARADA_RETORNOU_FILA,
  PARADA_CHEGADA: EventoTempoReal.PARADA_CHEGADA,
  PARADA_FINALIZADA: EventoTempoReal.PARADA_FINALIZADA,
  PARADA_CANCELADA: EventoTempoReal.PARADA_CANCELADA,
  SERVICO_REALIZADO: EventoTempoReal.SERVICO_REALIZADO,
  SERVICO_NAO_REALIZADO: EventoTempoReal.SERVICO_NAO_REALIZADO,
  OCORRENCIA_REGISTRADA: EventoTempoReal.OCORRENCIA_REGISTRADA,
};

/** `status` e `versao` são da rota depois da mudança; ausentes quando a rota foi excluída. */
export const payloadTempoRealSchema = z
  .object({
    rotaId: z.uuid(),
    paradaId: z.uuid().optional(),
    status: statusRotaSchema.optional(),
    versao: z.number().int().optional(),
  })
  .strict();
export type PayloadTempoReal = z.infer<typeof payloadTempoRealSchema>;

/** Motivo enviado pelo servidor ao recusar o handshake ou derrubar a conexão (token vencido). */
export const MOTIVO_TEMPO_REAL_NAO_AUTENTICADO = 'NAO_AUTENTICADO';

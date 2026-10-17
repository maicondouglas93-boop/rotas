// Nomes de eventos Socket.IO no formato entidade.acao (skill architecture-guardian).
// Payload mínimo: ids e status; o cliente busca o detalhe via REST.
export const EventoTempoReal = {
  ROTA_ENVIADA: 'rota.enviada',
  ROTA_EDITADA: 'rota.editada',
  ROTA_RECEBIDA: 'rota.recebida',
  ROTA_INICIADA: 'rota.iniciada',
  ROTA_CONCLUIDA: 'rota.concluida',
  ROTA_CANCELADA: 'rota.cancelada',
  ROTA_TRANSFERIDA: 'rota.transferida',
  PARADA_A_CAMINHO: 'parada.a_caminho',
  PARADA_CHEGADA: 'parada.chegada',
  PARADA_FINALIZADA: 'parada.finalizada',
  OCORRENCIA_REGISTRADA: 'ocorrencia.registrada',
} as const;
export type EventoTempoReal = (typeof EventoTempoReal)[keyof typeof EventoTempoReal];

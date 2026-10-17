import type { TipoEventoRota, TipoOcorrencia } from './historico.js';
import type { StatusParada, StatusRota, StatusServico, TipoServico } from './status.js';

// Textos exibidos ao usuário (painel e app). Os valores dos enums nunca aparecem crus na interface.

export const ROTULO_STATUS_ROTA: Record<StatusRota, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADA: 'Enviada',
  RECEBIDA: 'Recebida',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

export const ROTULO_STATUS_PARADA: Record<StatusParada, string> = {
  PENDENTE: 'Pendente',
  A_CAMINHO: 'A caminho',
  NO_LOCAL: 'No local',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

// Feminino porque o status sempre aparece ao lado do tipo: "Coleta realizada", "Entrega não realizada".
export const ROTULO_STATUS_SERVICO: Record<StatusServico, string> = {
  PENDENTE: 'Pendente',
  REALIZADO: 'Realizada',
  NAO_REALIZADO: 'Não realizada',
  CANCELADO: 'Cancelada',
};

export const ROTULO_TIPO_SERVICO: Record<TipoServico, string> = {
  COLETA: 'Coleta',
  ENTREGA: 'Entrega',
};

export const ROTULO_TIPO_OCORRENCIA: Record<TipoOcorrencia, string> = {
  ENDERECO_INCORRETO: 'Endereço incorreto',
  EMPRESA_FECHADA: 'Empresa fechada',
  CLIENTE_AUSENTE: 'Cliente ausente',
  RECUSA_RECEBIMENTO: 'Recusou o recebimento',
  MERCADORIA_INDISPONIVEL: 'Mercadoria indisponível',
  ENTREGA_NAO_REALIZADA: 'Entrega não realizada',
  OUTRO: 'Outro',
};

export const ROTULO_EVENTO_ROTA: Record<TipoEventoRota, string> = {
  ROTA_CRIADA: 'Rota criada',
  ROTA_EDITADA: 'Rota editada',
  ROTA_ENVIADA: 'Enviada ao motorista',
  ROTA_RECEBIDA: 'Recebimento confirmado',
  ROTA_INICIADA: 'Rota iniciada',
  ROTA_CONCLUIDA: 'Rota concluída',
  ROTA_CANCELADA: 'Rota cancelada',
  ROTA_TRANSFERIDA: 'Transferida para outro motorista',
  PARADA_A_CAMINHO: 'A caminho da parada',
  PARADA_RETORNOU_FILA: 'Parada voltou para a fila',
  PARADA_CHEGADA: 'Chegou à parada',
  PARADA_FINALIZADA: 'Parada finalizada',
  PARADA_CANCELADA: 'Parada cancelada',
  SERVICO_REALIZADO: 'Serviço realizado',
  SERVICO_NAO_REALIZADO: 'Serviço não realizado',
  OCORRENCIA_REGISTRADA: 'Ocorrência registrada',
};

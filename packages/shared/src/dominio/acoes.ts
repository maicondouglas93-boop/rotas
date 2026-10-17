import { StatusParada, StatusRota } from './status.js';

// Ações que a interface do admin oferece em cada status da rota. A API continua decidindo
// (delivery-domain-rules); este mapa só evita mostrar botões que certamente seriam recusados.

export interface AcoesAdminRota {
  editar: boolean;
  enviar: boolean;
  cancelar: boolean;
  transferir: boolean;
  excluir: boolean;
  duplicar: boolean;
  cancelarParada: boolean;
}

export function acoesAdminRota(status: StatusRota): AcoesAdminRota {
  const aberta = status !== StatusRota.CONCLUIDA && status !== StatusRota.CANCELADA;
  const enviadaAoMotorista =
    status === StatusRota.ENVIADA || status === StatusRota.RECEBIDA || status === StatusRota.EM_ANDAMENTO;
  return {
    editar: aberta,
    enviar: status === StatusRota.RASCUNHO,
    cancelar: aberta,
    transferir: enviadaAoMotorista,
    excluir: status === StatusRota.RASCUNHO,
    duplicar: true,
    cancelarParada: status === StatusRota.EM_ANDAMENTO,
  };
}

// Ações que o app do motorista mostra. Pré-condições que dependem de outras paradas
// (uma parada ativa por vez, outra rota em andamento) continuam sendo checadas pela API.

export function acoesMotoristaRota(status: StatusRota) {
  return {
    confirmarRecebimento: status === StatusRota.ENVIADA,
    iniciar: status === StatusRota.RECEBIDA,
  };
}

export function acoesMotoristaParada(statusRota: StatusRota, statusParada: StatusParada) {
  const emAndamento = statusRota === StatusRota.EM_ANDAMENTO;
  return {
    seguir: emAndamento && statusParada === StatusParada.PENDENTE,
    voltarParaFila: emAndamento && statusParada === StatusParada.A_CAMINHO,
    chegar: emAndamento && statusParada === StatusParada.A_CAMINHO,
    realizarServico: emAndamento && statusParada === StatusParada.NO_LOCAL,
    naoRealizarServico:
      emAndamento && (statusParada === StatusParada.A_CAMINHO || statusParada === StatusParada.NO_LOCAL),
    registrarOcorrencia:
      emAndamento && (statusParada === StatusParada.A_CAMINHO || statusParada === StatusParada.NO_LOCAL),
  };
}

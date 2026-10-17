import { StatusRota } from './status.js';

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

import {
  STATUS_PARADA_TERMINAIS,
  STATUS_SERVICO_TERMINAIS,
  StatusParada,
  StatusRota,
  StatusServico,
} from '@rotas/shared';

export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: string };

export type Ator = 'ADMIN' | 'MOTORISTA_DA_ROTA' | 'SISTEMA';

export type ComandoRota =
  | 'ENVIAR'
  | 'CONFIRMAR_RECEBIMENTO'
  | 'INICIAR'
  | 'CONCLUIR'
  | 'CANCELAR'
  | 'TRANSFERIR'
  | 'EDITAR_ESTRUTURA'
  | 'EXCLUIR';

export type ComandoParada = 'SEGUIR_PARA' | 'VOLTAR_PARA_FILA' | 'CHEGAR' | 'CANCELAR_PARADA';

export type ComandoServico = 'REALIZAR' | 'NAO_REALIZAR';

export const COMANDOS_ROTA: readonly ComandoRota[] = [
  'ENVIAR',
  'CONFIRMAR_RECEBIMENTO',
  'INICIAR',
  'CONCLUIR',
  'CANCELAR',
  'TRANSFERIR',
  'EDITAR_ESTRUTURA',
  'EXCLUIR',
];

export const COMANDOS_PARADA: readonly ComandoParada[] = [
  'SEGUIR_PARA',
  'VOLTAR_PARA_FILA',
  'CHEGAR',
  'CANCELAR_PARADA',
];

export const COMANDOS_SERVICO: readonly ComandoServico[] = ['REALIZAR', 'NAO_REALIZAR'];

interface RegraTransicaoRota {
  readonly ator: Ator;
  readonly transicoes: Partial<Record<StatusRota, StatusRota | null>>;
  readonly motivoAtor: string;
  readonly motivoStatus: string;
}

const TABELA_TRANSICOES_ROTA: Record<ComandoRota, RegraTransicaoRota> = {
  ENVIAR: {
    ator: 'ADMIN',
    transicoes: {
      [StatusRota.RASCUNHO]: StatusRota.ENVIADA,
    },
    motivoAtor: 'Apenas a administração pode enviar a rota.',
    motivoStatus: 'A rota só pode ser enviada enquanto estiver em rascunho.',
  },
  CONFIRMAR_RECEBIMENTO: {
    ator: 'MOTORISTA_DA_ROTA',
    transicoes: {
      [StatusRota.ENVIADA]: StatusRota.RECEBIDA,
    },
    motivoAtor: 'Apenas o motorista responsável pela rota pode confirmar o recebimento.',
    motivoStatus: 'O recebimento só pode ser confirmado quando a rota estiver enviada.',
  },
  INICIAR: {
    ator: 'MOTORISTA_DA_ROTA',
    transicoes: {
      [StatusRota.RECEBIDA]: StatusRota.EM_ANDAMENTO,
    },
    motivoAtor: 'Apenas o motorista responsável pela rota pode iniciá-la.',
    motivoStatus: 'A rota só pode ser iniciada após a confirmação de recebimento.',
  },
  CONCLUIR: {
    ator: 'SISTEMA',
    transicoes: {
      [StatusRota.EM_ANDAMENTO]: StatusRota.CONCLUIDA,
    },
    motivoAtor: 'A conclusão da rota é realizada automaticamente pelo sistema.',
    motivoStatus: 'Apenas uma rota em andamento pode ser concluída.',
  },
  CANCELAR: {
    ator: 'ADMIN',
    transicoes: {
      [StatusRota.RASCUNHO]: StatusRota.CANCELADA,
      [StatusRota.ENVIADA]: StatusRota.CANCELADA,
      [StatusRota.RECEBIDA]: StatusRota.CANCELADA,
      [StatusRota.EM_ANDAMENTO]: StatusRota.CANCELADA,
    },
    motivoAtor: 'Apenas a administração pode cancelar a rota.',
    motivoStatus: 'Não é possível cancelar uma rota já concluída ou cancelada.',
  },
  TRANSFERIR: {
    ator: 'ADMIN',
    transicoes: {
      [StatusRota.ENVIADA]: StatusRota.ENVIADA,
      [StatusRota.RECEBIDA]: StatusRota.ENVIADA,
      [StatusRota.EM_ANDAMENTO]: StatusRota.ENVIADA,
    },
    motivoAtor: 'Apenas a administração pode transferir a rota para outro motorista.',
    motivoStatus: 'A rota só pode ser transferida quando estiver enviada, recebida ou em andamento.',
  },
  EDITAR_ESTRUTURA: {
    ator: 'ADMIN',
    transicoes: {
      [StatusRota.RASCUNHO]: StatusRota.RASCUNHO,
      [StatusRota.ENVIADA]: StatusRota.ENVIADA,
      [StatusRota.RECEBIDA]: StatusRota.ENVIADA,
      [StatusRota.EM_ANDAMENTO]: StatusRota.EM_ANDAMENTO,
    },
    motivoAtor: 'Apenas a administração pode editar a estrutura da rota.',
    motivoStatus: 'Uma rota concluída ou cancelada não pode ser alterada.',
  },
  EXCLUIR: {
    ator: 'ADMIN',
    transicoes: {
      [StatusRota.RASCUNHO]: null,
    },
    motivoAtor: 'Apenas a administração pode excluir a rota.',
    motivoStatus: 'Apenas rotas em rascunho podem ser excluídas.',
  },
};

interface RegraTransicaoParada {
  readonly ator: Ator;
  readonly rotaPermitida: (statusRota: StatusRota) => boolean;
  readonly transicoes: Partial<Record<StatusParada, StatusParada>>;
  readonly motivoAtor: string;
  readonly motivoRota: string;
  readonly motivoStatus: string;
}

const rotaEmAndamento = (statusRota: StatusRota): boolean => statusRota === StatusRota.EM_ANDAMENTO;

const TABELA_TRANSICOES_PARADA: Record<ComandoParada, RegraTransicaoParada> = {
  SEGUIR_PARA: {
    ator: 'MOTORISTA_DA_ROTA',
    rotaPermitida: rotaEmAndamento,
    transicoes: {
      [StatusParada.PENDENTE]: StatusParada.A_CAMINHO,
    },
    motivoAtor: 'Apenas o motorista responsável pela rota pode seguir para a parada.',
    motivoRota: 'A rota precisa estar em andamento para seguir para uma parada.',
    motivoStatus: 'Só é possível seguir para uma parada que esteja pendente.',
  },
  VOLTAR_PARA_FILA: {
    ator: 'MOTORISTA_DA_ROTA',
    rotaPermitida: rotaEmAndamento,
    transicoes: {
      [StatusParada.A_CAMINHO]: StatusParada.PENDENTE,
    },
    motivoAtor: 'Apenas o motorista responsável pela rota pode devolver a parada para a fila.',
    motivoRota: 'A rota precisa estar em andamento para devolver a parada para a fila.',
    motivoStatus: 'Só é possível devolver para a fila uma parada que esteja a caminho.',
  },
  CHEGAR: {
    ator: 'MOTORISTA_DA_ROTA',
    rotaPermitida: rotaEmAndamento,
    transicoes: {
      [StatusParada.A_CAMINHO]: StatusParada.NO_LOCAL,
    },
    motivoAtor: 'Apenas o motorista responsável pela rota pode informar chegada na parada.',
    motivoRota: 'A rota precisa estar em andamento para informar chegada na parada.',
    motivoStatus: 'Só é possível informar chegada em uma parada que esteja a caminho.',
  },
  CANCELAR_PARADA: {
    ator: 'ADMIN',
    // Antes do início da rota a parada é removida pela edição da rota, não cancelada.
    rotaPermitida: rotaEmAndamento,
    transicoes: {
      [StatusParada.PENDENTE]: StatusParada.CANCELADA,
      [StatusParada.A_CAMINHO]: StatusParada.CANCELADA,
    },
    motivoAtor: 'Apenas a administração pode cancelar uma parada.',
    motivoRota: 'Só é possível cancelar paradas de uma rota em andamento. Antes disso, remova a parada editando a rota.',
    motivoStatus: 'Só é possível cancelar paradas pendentes ou a caminho.',
  },
};

interface RegraTransicaoServico {
  readonly ator: Ator;
  readonly paradasPermitidas: readonly StatusParada[];
  readonly transicoes: Partial<Record<StatusServico, StatusServico>>;
  readonly motivoAtor: string;
  readonly motivoParada: string;
  readonly motivoStatus: string;
}

const TABELA_TRANSICOES_SERVICO: Record<ComandoServico, RegraTransicaoServico> = {
  REALIZAR: {
    ator: 'MOTORISTA_DA_ROTA',
    paradasPermitidas: [StatusParada.NO_LOCAL],
    transicoes: {
      [StatusServico.PENDENTE]: StatusServico.REALIZADO,
    },
    motivoAtor: 'Apenas o motorista responsável pela rota pode realizar o serviço.',
    motivoParada: 'O motorista precisa estar no local da parada para realizar o serviço.',
    motivoStatus: 'Apenas serviços pendentes podem ser marcados como realizados.',
  },
  NAO_REALIZAR: {
    ator: 'MOTORISTA_DA_ROTA',
    paradasPermitidas: [StatusParada.A_CAMINHO, StatusParada.NO_LOCAL],
    transicoes: {
      [StatusServico.PENDENTE]: StatusServico.NAO_REALIZADO,
    },
    motivoAtor: 'Apenas o motorista responsável pela rota pode registrar serviço não realizado.',
    motivoParada: 'A parada precisa estar a caminho ou no local para registrar o serviço como não realizado.',
    motivoStatus: 'Apenas serviços pendentes podem ser marcados como não realizados.',
  },
};

/** Status de destino da rota; `null` quando o comando é EXCLUIR (exclusão física). */
export function transicaoRota(
  status: StatusRota,
  comando: ComandoRota,
  ator: Ator,
): Resultado<StatusRota | null> {
  const regra = TABELA_TRANSICOES_ROTA[comando];
  if (ator !== regra.ator) {
    return { ok: false, motivo: regra.motivoAtor };
  }

  const destino = regra.transicoes[status];
  if (destino === undefined) {
    return { ok: false, motivo: regra.motivoStatus };
  }

  return { ok: true, valor: destino };
}

/** `statusRota` é o status atual da rota dona da parada. */
export function transicaoParada(
  status: StatusParada,
  comando: ComandoParada,
  ator: Ator,
  statusRota: StatusRota,
): Resultado<StatusParada> {
  const regra = TABELA_TRANSICOES_PARADA[comando];
  if (ator !== regra.ator) {
    return { ok: false, motivo: regra.motivoAtor };
  }

  if (!regra.rotaPermitida(statusRota)) {
    return { ok: false, motivo: regra.motivoRota };
  }

  const destino = regra.transicoes[status];
  if (destino === undefined) {
    return { ok: false, motivo: regra.motivoStatus };
  }

  return { ok: true, valor: destino };
}

/** `statusParada` é o status atual da parada dona do serviço. */
export function transicaoServico(
  status: StatusServico,
  comando: ComandoServico,
  ator: Ator,
  statusParada: StatusParada,
): Resultado<StatusServico> {
  const regra = TABELA_TRANSICOES_SERVICO[comando];
  if (ator !== regra.ator) {
    return { ok: false, motivo: regra.motivoAtor };
  }

  if (!regra.paradasPermitidas.includes(statusParada)) {
    return { ok: false, motivo: regra.motivoParada };
  }

  const destino = regra.transicoes[status];
  if (destino === undefined) {
    return { ok: false, motivo: regra.motivoStatus };
  }

  return { ok: true, valor: destino };
}

/** true quando todos os serviços da parada estão em status terminal (e há pelo menos um). */
export function paradaDeveFinalizar(servicos: readonly StatusServico[]): boolean {
  return servicos.length > 0 && servicos.every((servico) => STATUS_SERVICO_TERMINAIS.includes(servico));
}

/** true quando todas as paradas da rota estão em status terminal (e há pelo menos uma). */
export function rotaDeveConcluir(paradas: readonly StatusParada[]): boolean {
  return paradas.length > 0 && paradas.every((parada) => STATUS_PARADA_TERMINAIS.includes(parada));
}

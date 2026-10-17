import { StatusParada, StatusRota, type TipoServico } from '@rotas/shared';
import type { Resultado } from './transicoes.js';

// Regras de edição da estrutura e de envio (delivery-domain-rules, "Edição de rota").
// Funções puras: recebem o estado atual e o desejado, devolvem o plano ou o motivo da recusa.

export interface ParadaAtual {
  id: string;
  empresaId: string;
  status: StatusParada;
  servicos: readonly TipoServico[];
  observacoes: string | null;
}

export interface ParadaDesejada {
  id?: string;
  empresaId: string;
  servicos: readonly TipoServico[];
  observacoes?: string | null;
}

export interface ParadaMantida {
  id: string;
  servicosAdicionar: TipoServico[];
  servicosRemover: TipoServico[];
  /** `undefined` quando a observação não muda. */
  observacoes: string | null | undefined;
}

export interface ParadaNova {
  empresaId: string;
  servicos: TipoServico[];
  observacoes: string | null;
}

export interface PlanoEdicao {
  removidas: string[];
  mantidas: ParadaMantida[];
  novas: ParadaNova[];
  /** Ordem final: id de parada existente ou índice em `novas`. */
  ordem: ({ id: string } | { nova: number })[];
  reordenou: boolean;
}

const STATUS_COM_ESTRUTURA_LIVRE: readonly StatusRota[] = [StatusRota.RASCUNHO, StatusRota.ENVIADA, StatusRota.RECEBIDA];
const PARADA_ENCERRADA: readonly StatusParada[] = [StatusParada.FINALIZADA, StatusParada.CANCELADA];

function erro<T>(motivo: string): Resultado<T> {
  return { ok: false, motivo };
}

function mesmosServicos(a: readonly TipoServico[], b: readonly TipoServico[]): boolean {
  return a.length === b.length && a.every((t) => b.includes(t));
}

/**
 * Calcula o que muda nas paradas. `atuais` deve vir na ordem atual (por sequência).
 * Em RASCUNHO, ENVIADA e RECEBIDA nada foi executado: tudo pode mudar.
 * Em EM_ANDAMENTO: nenhuma parada sai (cancela-se), paradas já iniciadas mantêm serviços e ordem relativa,
 * e paradas encerradas não mudam nem a observação.
 */
export function planejarEdicaoParadas(
  statusRota: StatusRota,
  atuais: readonly ParadaAtual[],
  desejadas: readonly ParadaDesejada[],
): Resultado<PlanoEdicao> {
  const emAndamento = statusRota === StatusRota.EM_ANDAMENTO;
  if (!emAndamento && !STATUS_COM_ESTRUTURA_LIVRE.includes(statusRota)) {
    return erro('Uma rota concluída ou cancelada não pode ser alterada.');
  }

  const porId = new Map(atuais.map((p) => [p.id, p]));
  const mantidas: ParadaMantida[] = [];
  const novas: ParadaNova[] = [];
  const ordem: PlanoEdicao['ordem'] = [];

  for (const desejada of desejadas) {
    if (desejada.id === undefined) {
      ordem.push({ nova: novas.length });
      novas.push({ empresaId: desejada.empresaId, servicos: [...desejada.servicos], observacoes: desejada.observacoes ?? null });
      continue;
    }

    const atual = porId.get(desejada.id);
    if (!atual) return erro('Uma das paradas informadas não pertence a esta rota.');
    if (atual.empresaId !== desejada.empresaId) {
      return erro('Não é possível trocar a empresa de uma parada existente. Remova-a e adicione outra.');
    }

    const servicosMudaram = !mesmosServicos(atual.servicos, desejada.servicos);
    const observacoes =
      desejada.observacoes === undefined || desejada.observacoes === atual.observacoes ? undefined : desejada.observacoes;

    if (emAndamento && atual.status !== StatusParada.PENDENTE && servicosMudaram) {
      return erro('Não é possível alterar os serviços de uma parada já iniciada ou finalizada.');
    }
    if (emAndamento && PARADA_ENCERRADA.includes(atual.status) && observacoes !== undefined) {
      return erro('Não é possível alterar uma parada já finalizada ou cancelada.');
    }

    ordem.push({ id: atual.id });
    mantidas.push({
      id: atual.id,
      servicosAdicionar: desejada.servicos.filter((t) => !atual.servicos.includes(t)),
      servicosRemover: atual.servicos.filter((t) => !desejada.servicos.includes(t)),
      observacoes,
    });
  }

  const idsMantidos = new Set(mantidas.map((m) => m.id));
  const removidas = atuais.filter((p) => !idsMantidos.has(p.id)).map((p) => p.id);
  if (emAndamento && removidas.length > 0) {
    return erro('Em uma rota em andamento a parada não é removida: cancele a parada.');
  }

  if (emAndamento) {
    const iniciadasAntes = atuais.filter((p) => p.status !== StatusParada.PENDENTE).map((p) => p.id);
    const iniciadasDepois = ordem.flatMap((o) => ('id' in o && iniciadasAntes.includes(o.id) ? [o.id] : []));
    if (iniciadasAntes.join() !== iniciadasDepois.join()) {
      return erro('A ordem das paradas já iniciadas ou finalizadas não pode mudar.');
    }
  }

  const ordemAntes = atuais.filter((p) => idsMantidos.has(p.id)).map((p) => p.id);
  const ordemDepois = ordem.flatMap((o) => ('id' in o ? [o.id] : []));
  const reordenou = ordemAntes.join() !== ordemDepois.join();

  return { ok: true, valor: { removidas, mantidas, novas, ordem, reordenou } };
}

/** Campos da rota (fora as paradas) que podem mudar em cada status. */
export function validarCamposEdicao(
  statusRota: StatusRota,
  atual: { dataPrevista: string; motoristaId: string | null },
  desejado: { dataPrevista: string; motoristaId: string | null },
): Resultado<void> {
  if (statusRota !== StatusRota.RASCUNHO && desejado.motoristaId !== atual.motoristaId) {
    return erro('Depois do envio, troque o motorista pela transferência da rota.');
  }
  if (statusRota === StatusRota.EM_ANDAMENTO && desejado.dataPrevista !== atual.dataPrevista) {
    return erro('Não é possível mudar a data de uma rota em andamento.');
  }
  return { ok: true, valor: undefined };
}

export interface DadosEnvio {
  /** `null` quando a rota ainda não tem motorista. */
  motoristaAtivo: boolean | null;
  paradas: readonly { nomeEmpresa: string; quantidadeServicos: number; empresaArquivada: boolean }[];
}

/** Pré-condições do comando ENVIAR (tabela "Transições da rota"). */
export function validarEnvio(dados: DadosEnvio): Resultado<void> {
  if (dados.motoristaAtivo === null) return erro('Defina o motorista antes de enviar a rota.');
  if (!dados.motoristaAtivo) return erro('O motorista escolhido está desativado. Escolha outro antes de enviar.');
  if (dados.paradas.length === 0) return erro('Adicione ao menos uma parada antes de enviar a rota.');
  if (dados.paradas.some((p) => p.quantidadeServicos === 0)) {
    return erro('Toda parada precisa de ao menos um serviço (coleta ou entrega).');
  }
  const arquivada = dados.paradas.find((p) => p.empresaArquivada);
  if (arquivada) {
    return erro(`A empresa ${arquivada.nomeEmpresa} está arquivada. Remova a parada ou reative a empresa antes de enviar.`);
  }
  return { ok: true, valor: undefined };
}

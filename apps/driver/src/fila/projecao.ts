import {
  STATUS_PARADA_TERMINAIS,
  STATUS_SERVICO_TERMINAIS,
  type Parada,
  type Rota,
  type RotaResumo,
  type Servico,
} from '@rotas/shared';
import type { ComandoNaFila } from './fila-comandos';

// Estado previsto da rota depois dos comandos que ainda estão na fila, aplicados em ordem sobre o
// último estado confirmado pelo servidor. Serve só para a tela liberar a próxima ação sem sinal:
// cada item afetado continua marcado "aguardando envio" e o servidor tem a palavra final
// (se ele recusar um comando, a fila o descarta e a projeção volta ao estado real).

type Acao =
  | { tipo: 'confirmar' | 'iniciar' }
  | { tipo: 'seguir' | 'voltar' | 'cheguei'; paradaId: string }
  | { tipo: 'realizar' | 'nao-realizar'; servicoId: string };

const PADROES: { padrao: RegExp; acao: (id: string) => Acao }[] = [
  { padrao: /^\/motorista\/rotas\/[^/]+\/confirmar-recebimento$/, acao: () => ({ tipo: 'confirmar' }) },
  { padrao: /^\/motorista\/rotas\/[^/]+\/iniciar$/, acao: () => ({ tipo: 'iniciar' }) },
  { padrao: /^\/motorista\/paradas\/([^/]+)\/seguir$/, acao: (paradaId) => ({ tipo: 'seguir', paradaId }) },
  { padrao: /^\/motorista\/paradas\/([^/]+)\/voltar-para-fila$/, acao: (paradaId) => ({ tipo: 'voltar', paradaId }) },
  { padrao: /^\/motorista\/paradas\/([^/]+)\/cheguei$/, acao: (paradaId) => ({ tipo: 'cheguei', paradaId }) },
  { padrao: /^\/motorista\/servicos\/([^/]+)\/realizar$/, acao: (servicoId) => ({ tipo: 'realizar', servicoId }) },
  { padrao: /^\/motorista\/servicos\/([^/]+)\/nao-realizar$/, acao: (servicoId) => ({ tipo: 'nao-realizar', servicoId }) },
];

/** Comando que muda estado; `null` para os que não mudam (ex.: ocorrência informativa). */
export function interpretarComando(caminho: string): Acao | null {
  for (const { padrao, acao } of PADROES) {
    const achado = padrao.exec(caminho);
    if (achado) return acao(achado[1] ?? '');
  }
  return null;
}

const comParada = (rota: Rota, paradaId: string, mudar: (p: Parada) => Parada): Rota => ({
  ...rota,
  paradas: rota.paradas.map((p) => (p.id === paradaId ? mudar(p) : p)),
});

/** Mesma regra do servidor: todos os serviços encerrados finalizam a parada; todas as paradas encerradas concluem a rota. */
function encerrarSePreciso(rota: Rota, paradaId: string, quando: string): Rota {
  const parada = rota.paradas.find((p) => p.id === paradaId);
  if (!parada || STATUS_PARADA_TERMINAIS.includes(parada.status)) return rota;
  if (!parada.servicos.every((s) => STATUS_SERVICO_TERMINAIS.includes(s.status))) return rota;
  const comParadaFinalizada = comParada(rota, paradaId, (p) => ({ ...p, status: 'FINALIZADA', finalizadaEm: quando }));
  const todasEncerradas = comParadaFinalizada.paradas.every((p) => STATUS_PARADA_TERMINAIS.includes(p.status));
  return todasEncerradas && rota.status === 'EM_ANDAMENTO'
    ? { ...comParadaFinalizada, status: 'CONCLUIDA', concluidaEm: quando }
    : comParadaFinalizada;
}

function encerrarServico(rota: Rota, servicoId: string, status: Servico['status'], quando: string): Rota {
  const parada = rota.paradas.find((p) => p.servicos.some((s) => s.id === servicoId));
  const servico = parada?.servicos.find((s) => s.id === servicoId);
  if (!parada || servico?.status !== 'PENDENTE' || rota.status !== 'EM_ANDAMENTO') return rota;
  const atualizada = comParada(rota, parada.id, (p) => ({
    ...p,
    servicos: p.servicos.map((s) => (s.id === servicoId ? { ...s, status, concluidoEm: quando } : s)),
  }));
  return encerrarSePreciso(atualizada, parada.id, quando);
}

/** Aplica um comando só se a transição valeria no estado atual; senão deixa como está (o servidor vai recusar). */
function aplicar(rota: Rota, acao: Acao, quando: string): Rota {
  const parada = 'paradaId' in acao ? rota.paradas.find((p) => p.id === acao.paradaId) : undefined;
  switch (acao.tipo) {
    case 'confirmar':
      return rota.status === 'ENVIADA' ? { ...rota, status: 'RECEBIDA', recebidaEm: quando } : rota;
    case 'iniciar':
      return rota.status === 'RECEBIDA' ? { ...rota, status: 'EM_ANDAMENTO', iniciadaEm: rota.iniciadaEm ?? quando } : rota;
    case 'seguir':
      if (rota.status !== 'EM_ANDAMENTO' || parada?.status !== 'PENDENTE') return rota;
      if (rota.paradas.some((p) => p.status === 'NO_LOCAL')) return rota;
      // No máximo uma parada a caminho: a anterior volta para a fila.
      return {
        ...rota,
        paradas: rota.paradas.map((p) =>
          p.id === acao.paradaId ? { ...p, status: 'A_CAMINHO' } : p.status === 'A_CAMINHO' ? { ...p, status: 'PENDENTE' } : p,
        ),
      };
    case 'voltar':
      return parada?.status === 'A_CAMINHO' ? comParada(rota, acao.paradaId, (p) => ({ ...p, status: 'PENDENTE' })) : rota;
    case 'cheguei':
      return parada?.status === 'A_CAMINHO'
        ? comParada(rota, acao.paradaId, (p) => ({ ...p, status: 'NO_LOCAL', chegadaEm: quando }))
        : rota;
    case 'realizar':
      return encerrarServico(rota, acao.servicoId, 'REALIZADO', quando);
    case 'nao-realizar':
      return encerrarServico(rota, acao.servicoId, 'NAO_REALIZADO', quando);
  }
}

export function projetarRota(rota: Rota, pendentes: readonly ComandoNaFila[]): Rota {
  return pendentes
    .filter((c) => c.rotaId === rota.id)
    .reduce((atual, comando) => {
      const acao = interpretarComando(comando.caminho);
      return acao ? aplicar(atual, acao, comando.criadoEm) : atual;
    }, rota);
}

/** Resumo da lista com o status e o progresso previstos, quando o detalhe da rota está no cache. */
export function projetarResumo(resumo: RotaResumo, detalhe: Rota | undefined, pendentes: readonly ComandoNaFila[]): RotaResumo {
  if (!detalhe || !pendentes.some((c) => c.rotaId === resumo.id)) return resumo;
  const prevista = projetarRota(detalhe, pendentes);
  return {
    ...resumo,
    status: prevista.status,
    paradasConcluidas: prevista.paradas.filter((p) => STATUS_PARADA_TERMINAIS.includes(p.status)).length,
  };
}

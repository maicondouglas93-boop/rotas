import type { RotaDoDia } from '@rotas/shared';
import { describe, expect, it } from 'vitest';
import { formatarDataPorExtenso, formatarHaQuanto } from './formatos';
import { pendenciasDoDia } from './pendencias';

const AGORA = new Date('2026-10-17T15:00:00Z').getTime();
const minutosAtras = (min: number) => new Date(AGORA - min * 60_000).toISOString();

function rota(sobrescritas: Partial<RotaDoDia>): RotaDoDia {
  return {
    id: crypto.randomUUID(),
    nome: 'Rota',
    status: 'EM_ANDAMENTO',
    motorista: { id: crypto.randomUUID(), nome: 'Joana', ativo: true },
    enviadaEm: minutosAtras(120),
    ultimaAtividadeEm: minutosAtras(5),
    ...sobrescritas,
  } as RotaDoDia;
}

describe('pendenciasDoDia', () => {
  it('aponta rascunho, envio sem confirmação, rota parada e motorista desativado', () => {
    const rotas = [
      rota({ nome: 'Rascunho', status: 'RASCUNHO', motorista: null }),
      rota({ nome: 'Sem confirmação', status: 'ENVIADA', enviadaEm: minutosAtras(45) }),
      rota({ nome: 'Parada', status: 'EM_ANDAMENTO', ultimaAtividadeEm: minutosAtras(90) }),
      rota({ nome: 'Desativado', status: 'RECEBIDA', motorista: { id: crypto.randomUUID(), nome: 'Ex', ativo: false } }),
    ];
    expect(pendenciasDoDia(rotas, AGORA).map((p) => [p.rota.nome, p.motivo])).toEqual([
      ['Rascunho', 'Rascunho sem motorista definido.'],
      ['Sem confirmação', 'Enviada há 45 min e ainda não confirmada.'],
      ['Parada', 'Sem atividade do motorista há 1 h.'],
      ['Desativado', 'Motorista desativado: transfira ou cancele a rota.'],
    ]);
  });

  it('ignora o que está andando bem, o recente e o que já acabou', () => {
    const rotas = [
      rota({ status: 'EM_ANDAMENTO', ultimaAtividadeEm: minutosAtras(10) }),
      rota({ status: 'ENVIADA', enviadaEm: minutosAtras(20) }),
      rota({ status: 'CONCLUIDA', ultimaAtividadeEm: minutosAtras(300) }),
      rota({ status: 'CANCELADA', motorista: { id: crypto.randomUUID(), nome: 'Ex', ativo: false } }),
    ];
    expect(pendenciasDoDia(rotas, AGORA)).toEqual([]);
  });
});

describe('formatos do dia', () => {
  it('tempo decorrido em texto curto', () => {
    expect(formatarHaQuanto(minutosAtras(0), AGORA)).toBe('agora há pouco');
    expect(formatarHaQuanto(minutosAtras(12), AGORA)).toBe('há 12 min');
    expect(formatarHaQuanto(minutosAtras(150), AGORA)).toBe('há 2 h');
    expect(formatarHaQuanto(minutosAtras(60 * 50), AGORA)).toBe('há 2 dias');
  });

  it('data por extenso sem mudar o dia', () => {
    expect(formatarDataPorExtenso('2026-10-17')).toBe('Sábado, 17 de outubro');
  });
});

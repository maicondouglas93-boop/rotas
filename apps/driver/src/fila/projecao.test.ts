import type { Parada, Rota, RotaResumo, Servico } from '@rotas/shared';
import type { ComandoNaFila } from './fila-comandos';
import { interpretarComando, projetarResumo, projetarRota } from './projecao';

const QUANDO = '2026-10-17T15:00:00.000Z';

const servico = (id: string, tipo: Servico['tipo'], status: Servico['status'] = 'PENDENTE'): Servico => ({
  id,
  tipo,
  status,
  concluidoEm: null,
});

const parada = (id: string, status: Parada['status'], servicos: Servico[]) =>
  ({ id, sequencia: 1, status, nomeEmpresa: id, servicos, chegadaEm: null, finalizadaEm: null }) as unknown as Parada;

function rota(status: Rota['status'], paradas: Parada[]): Rota {
  return { id: 'r1', status, paradas, recebidaEm: null, iniciadaEm: null, concluidaEm: null } as unknown as Rota;
}

let contador = 0;
function comando(caminho: string, rotaId = 'r1'): ComandoNaFila {
  contador += 1;
  return { chave: `k${contador}`, caminho, corpo: {}, rotaId, alvoId: 'x', descricao: '', criadoEm: QUANDO, tentativas: 0 };
}

const status = (r: Rota) => ({ rota: r.status, paradas: r.paradas.map((p) => p.status) });

describe('interpretarComando', () => {
  it('reconhece os comandos que mudam estado e ignora a ocorrência informativa', () => {
    expect(interpretarComando('/motorista/paradas/p1/cheguei')).toEqual({ tipo: 'cheguei', paradaId: 'p1' });
    expect(interpretarComando('/motorista/servicos/s1/nao-realizar')).toEqual({ tipo: 'nao-realizar', servicoId: 's1' });
    expect(interpretarComando('/motorista/rotas/r1/confirmar-recebimento')).toEqual({ tipo: 'confirmar' });
    expect(interpretarComando('/motorista/paradas/p1/ocorrencias')).toBeNull();
  });
});

describe('projetarRota', () => {
  it('sem comandos pendentes devolve a própria rota', () => {
    const r = rota('EM_ANDAMENTO', [parada('p1', 'PENDENTE', [servico('s1', 'ENTREGA')])]);
    expect(projetarRota(r, [])).toBe(r);
    expect(projetarRota(r, [comando('/motorista/paradas/p1/seguir', 'outra')])).toBe(r);
  });

  it('confirmar e iniciar sem sinal levam a rota a "em andamento"', () => {
    const r = rota('ENVIADA', [parada('p1', 'PENDENTE', [servico('s1', 'ENTREGA')])]);
    const prevista = projetarRota(r, [
      comando('/motorista/rotas/r1/confirmar-recebimento'),
      comando('/motorista/rotas/r1/iniciar'),
    ]);
    expect(prevista.status).toBe('EM_ANDAMENTO');
    expect(prevista.iniciadaEm).toBe(QUANDO);
  });

  it('a parada inteira sem sinal: seguir, chegar e concluir os serviços finaliza a parada', () => {
    const r = rota('EM_ANDAMENTO', [
      parada('p1', 'PENDENTE', [servico('s1', 'COLETA'), servico('s2', 'ENTREGA')]),
      parada('p2', 'PENDENTE', [servico('s3', 'ENTREGA')]),
    ]);
    const prevista = projetarRota(r, [
      comando('/motorista/paradas/p1/seguir'),
      comando('/motorista/paradas/p1/cheguei'),
      comando('/motorista/servicos/s1/realizar'),
      comando('/motorista/servicos/s2/nao-realizar'),
    ]);
    expect(status(prevista)).toEqual({ rota: 'EM_ANDAMENTO', paradas: ['FINALIZADA', 'PENDENTE'] });
    expect(prevista.paradas[0]!.servicos.map((s) => s.status)).toEqual(['REALIZADO', 'NAO_REALIZADO']);
    expect(prevista.paradas[0]!.chegadaEm).toBe(QUANDO);
  });

  it('última parada encerrada conclui a rota', () => {
    const r = rota('EM_ANDAMENTO', [
      parada('p1', 'FINALIZADA', [servico('s1', 'ENTREGA', 'REALIZADO')]),
      parada('p2', 'NO_LOCAL', [servico('s2', 'ENTREGA')]),
    ]);
    expect(status(projetarRota(r, [comando('/motorista/servicos/s2/realizar')]))).toEqual({
      rota: 'CONCLUIDA',
      paradas: ['FINALIZADA', 'FINALIZADA'],
    });
  });

  it('seguir para outra parada devolve a anterior para a fila', () => {
    const r = rota('EM_ANDAMENTO', [
      parada('p1', 'A_CAMINHO', [servico('s1', 'ENTREGA')]),
      parada('p2', 'PENDENTE', [servico('s2', 'ENTREGA')]),
    ]);
    expect(status(projetarRota(r, [comando('/motorista/paradas/p2/seguir')])).paradas).toEqual(['PENDENTE', 'A_CAMINHO']);
  });

  it('comando que o servidor recusaria não muda nada (parada cancelada pela administração)', () => {
    const r = rota('EM_ANDAMENTO', [parada('p1', 'CANCELADA', [servico('s1', 'ENTREGA', 'CANCELADO')])]);
    const prevista = projetarRota(r, [comando('/motorista/paradas/p1/seguir'), comando('/motorista/paradas/p1/cheguei')]);
    expect(status(prevista)).toEqual({ rota: 'EM_ANDAMENTO', paradas: ['CANCELADA'] });
  });
});

describe('projetarResumo', () => {
  const resumo = { id: 'r1', status: 'EM_ANDAMENTO', totalParadas: 2, paradasConcluidas: 0 } as RotaResumo;
  const detalhe = rota('EM_ANDAMENTO', [
    parada('p1', 'NO_LOCAL', [servico('s1', 'ENTREGA')]),
    parada('p2', 'PENDENTE', [servico('s2', 'ENTREGA')]),
  ]);

  it('atualiza status e progresso com o detalhe em cache', () => {
    expect(projetarResumo(resumo, detalhe, [comando('/motorista/servicos/s1/realizar')])).toMatchObject({
      status: 'EM_ANDAMENTO',
      paradasConcluidas: 1,
    });
  });

  it('sem detalhe em cache ou sem pendências mantém o resumo do servidor', () => {
    expect(projetarResumo(resumo, undefined, [comando('/motorista/servicos/s1/realizar')])).toBe(resumo);
    expect(projetarResumo(resumo, detalhe, [])).toBe(resumo);
  });
});

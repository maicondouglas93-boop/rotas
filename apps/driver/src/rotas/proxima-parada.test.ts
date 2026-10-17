import type { Parada } from '@rotas/shared';
import { proximaParada } from './proxima-parada';

const parada = (id: string, status: Parada['status']) => ({ id, status }) as Parada;

describe('proximaParada', () => {
  it('prefere a parada em curso à primeira pendente', () => {
    const paradas = [parada('a', 'PENDENTE'), parada('b', 'NO_LOCAL'), parada('c', 'PENDENTE')];
    expect(proximaParada(paradas)?.id).toBe('b');
  });

  it('ignora a parada informada e as encerradas', () => {
    const paradas = [parada('a', 'FINALIZADA'), parada('b', 'CANCELADA'), parada('c', 'A_CAMINHO'), parada('d', 'PENDENTE')];
    expect(proximaParada(paradas, 'c')?.id).toBe('d');
  });

  it('sem paradas abertas, não há próxima', () => {
    expect(proximaParada([parada('a', 'FINALIZADA'), parada('b', 'CANCELADA')])).toBeUndefined();
  });
});

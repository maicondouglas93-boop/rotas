/* eslint-disable @typescript-eslint/no-require-imports -- jest.resetModules exige require() para isolar o estado da fila entre testes */
import type { ErroApi as TipoErroApi, Rota } from '@rotas/shared';

let mockContadorUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `chave-${++mockContadorUuid}` }));
jest.mock('../api/cliente', () => ({ requisitar: jest.fn() }));

const ROTA: Rota = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  nome: 'Centro',
  dataPrevista: '2026-10-20',
  status: 'EM_ANDAMENTO',
  versao: 2,
  motorista: { id: '9b2d3c1e-1111-4a2b-8c3d-0e1f2a3b4c5d', nome: 'Marcos', ativo: true },
  ordemOrigem: 'MANUAL',
  distanciaEstimadaM: null,
  duracaoEstimadaS: null,
  enviadaEm: null,
  recebidaEm: null,
  iniciadaEm: null,
  concluidaEm: null,
  canceladaEm: null,
  motivoCancelamento: null,
  rotaOrigemId: null,
  criadoEm: '2026-10-20T10:00:00.000Z',
  atualizadoEm: '2026-10-20T10:00:00.000Z',
  paradas: [],
};

type Modulo = typeof import('./fila-comandos');
type Cliente = { requisitar: jest.Mock };

/** Estado da fila é do módulo: cada teste começa com módulos e armazenamento limpos. */
async function iniciar() {
  jest.resetModules();
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  await AsyncStorage.clear();
  const fila: Modulo = require('./fila-comandos');
  const cliente: Cliente = require('../api/cliente');
  // ErroApi do mesmo registro de módulos da fila (resetModules cria outra cópia do shared).
  const { ErroApi } = require('@rotas/shared') as { ErroApi: typeof TipoErroApi };
  const aoAtualizarRota = jest.fn();
  const aoRecusar = jest.fn();
  fila.configurarFila({ aoAtualizarRota, aoRecusar });
  return { fila, cliente, aoAtualizarRota, aoRecusar, AsyncStorage, ErroApi };
}

const novo = (alvo = 'p1') => ({ caminho: `/motorista/paradas/${alvo}/cheguei`, rotaId: ROTA.id, alvoId: alvo, descricao: 'Cheguei' });

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('fila de comandos do motorista', () => {
  it('envia com Idempotency-Key e horário do aparelho, e sai da fila no sucesso', async () => {
    const { fila, cliente, aoAtualizarRota } = await iniciar();
    cliente.requisitar.mockResolvedValue(ROTA);

    await fila.enfileirar(novo());
    await fila.processarFila();

    expect(cliente.requisitar).toHaveBeenCalledWith('/motorista/paradas/p1/cheguei', {
      method: 'POST',
      corpo: { ocorridoEm: expect.any(String) },
      chaveIdempotencia: expect.stringMatching(/^chave-/),
    });
    expect(fila.lerFila()).toHaveLength(0);
    expect(aoAtualizarRota).toHaveBeenCalledWith(ROTA);
  });

  it('sem conexão mantém o comando e reenvia depois com a MESMA chave', async () => {
    const { fila, cliente, ErroApi } = await iniciar();
    cliente.requisitar.mockRejectedValueOnce(ErroApi.semConexao()).mockResolvedValueOnce(ROTA);

    await fila.enfileirar(novo());
    await fila.processarFila();
    expect(fila.lerFila()).toHaveLength(1);
    expect(fila.lerFila()[0]!.tentativas).toBe(1);

    await jest.advanceTimersByTimeAsync(fila.ESPERAS_MS[0]);
    expect(fila.lerFila()).toHaveLength(0);
    const chaves = cliente.requisitar.mock.calls.map((c: [string, { chaveIdempotencia: string }]) => c[1].chaveIdempotencia);
    expect(new Set(chaves).size).toBe(1);
  });

  it('erro do servidor (5xx) também é repetido', async () => {
    const { fila, cliente, ErroApi } = await iniciar();
    cliente.requisitar.mockRejectedValueOnce(new ErroApi(503, 'ERRO_INTERNO', 'Indisponível'));
    await fila.enfileirar(novo());
    await fila.processarFila();
    expect(fila.lerFila()).toHaveLength(1);
  });

  it('comando recusado pela API sai da fila e avisa o motivo', async () => {
    const { fila, cliente, aoRecusar, ErroApi } = await iniciar();
    cliente.requisitar.mockRejectedValue(
      new ErroApi(409, 'TRANSICAO_INVALIDA', 'Esta parada foi cancelada pela administração.'),
    );
    const comando = await fila.enfileirar(novo());
    await fila.processarFila();
    expect(fila.lerFila()).toHaveLength(0);
    expect(aoRecusar).toHaveBeenCalledWith(expect.objectContaining({ chave: comando.chave }), 'Esta parada foi cancelada pela administração.');
  });

  it('respeita a ordem: com o primeiro sem rede, o segundo espera', async () => {
    const { fila, cliente, ErroApi } = await iniciar();
    cliente.requisitar.mockRejectedValue(ErroApi.semConexao());
    await fila.enfileirar(novo('p1'));
    await fila.enfileirar(novo('p2'));
    await fila.processarFila();
    expect(fila.lerFila().map((c) => c.alvoId)).toEqual(['p1', 'p2']);
    expect(cliente.requisitar.mock.calls.every((c: [string]) => c[0].includes('/p1/'))).toBe(true);
  });

  it('a fila sobrevive ao app fechar (persistida no aparelho)', async () => {
    const { fila, cliente, AsyncStorage, ErroApi } = await iniciar();
    cliente.requisitar.mockRejectedValue(ErroApi.semConexao());
    await fila.enfileirar(novo());
    const salvo = JSON.parse(await AsyncStorage.getItem('rotas.fila-comandos'));
    expect(salvo).toHaveLength(1);

    // App reaberto: módulos novos; o armazenamento do aparelho mantém o que foi gravado.
    jest.resetModules();
    await require('@react-native-async-storage/async-storage').setItem('rotas.fila-comandos', JSON.stringify(salvo));
    const reaberta: Modulo = require('./fila-comandos');
    await reaberta.carregarFila();
    expect(reaberta.lerFila().map((c) => c.chave)).toEqual(salvo.map((c: { chave: string }) => c.chave));
  });

  it('limparFila (logout) apaga tudo', async () => {
    const { fila, cliente, ErroApi } = await iniciar();
    cliente.requisitar.mockRejectedValue(ErroApi.semConexao());
    await fila.enfileirar(novo());
    await fila.limparFila();
    expect(fila.lerFila()).toHaveLength(0);
  });
});

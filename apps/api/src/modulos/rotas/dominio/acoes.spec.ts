import { acoesAdminRota, acoesMotoristaParada, acoesMotoristaRota, StatusParada, StatusRota } from '@rotas/shared';
import { transicaoParada, transicaoRota, transicaoServico } from './transicoes.js';

// O mapa de ações da interface (packages/shared) precisa concordar com a máquina de estados da API.
describe('acoesAdminRota × transições', () => {
  it.each(Object.values(StatusRota))('status %s', (status) => {
    const acoes = acoesAdminRota(status);
    expect(acoes.editar).toBe(transicaoRota(status, 'EDITAR_ESTRUTURA', 'ADMIN').ok);
    expect(acoes.enviar).toBe(transicaoRota(status, 'ENVIAR', 'ADMIN').ok);
    expect(acoes.cancelar).toBe(transicaoRota(status, 'CANCELAR', 'ADMIN').ok);
    expect(acoes.transferir).toBe(transicaoRota(status, 'TRANSFERIR', 'ADMIN').ok);
    expect(acoes.excluir).toBe(transicaoRota(status, 'EXCLUIR', 'ADMIN').ok);
    expect(acoes.cancelarParada).toBe(transicaoParada(StatusParada.PENDENTE, 'CANCELAR_PARADA', 'ADMIN', status).ok);
  });
});

describe('acoes do motorista × transições', () => {
  it.each(Object.values(StatusRota))('rota %s', (status) => {
    const acoes = acoesMotoristaRota(status);
    expect(acoes.confirmarRecebimento).toBe(transicaoRota(status, 'CONFIRMAR_RECEBIMENTO', 'MOTORISTA_DA_ROTA').ok);
    expect(acoes.iniciar).toBe(transicaoRota(status, 'INICIAR', 'MOTORISTA_DA_ROTA').ok);
  });

  const pares = Object.values(StatusRota).flatMap((r) => Object.values(StatusParada).map((p) => [r, p] as const));
  it.each(pares)('rota %s, parada %s', (statusRota, statusParada) => {
    const acoes = acoesMotoristaParada(statusRota, statusParada);
    const ator = 'MOTORISTA_DA_ROTA' as const;
    expect(acoes.seguir).toBe(transicaoParada(statusParada, 'SEGUIR_PARA', ator, statusRota).ok);
    expect(acoes.voltarParaFila).toBe(transicaoParada(statusParada, 'VOLTAR_PARA_FILA', ator, statusRota).ok);
    expect(acoes.chegar).toBe(transicaoParada(statusParada, 'CHEGAR', ator, statusRota).ok);
    // Serviço pendente: a ação aparece quando a transição do serviço é permitida e a rota está em andamento.
    const emAndamento = statusRota === 'EM_ANDAMENTO';
    expect(acoes.realizarServico).toBe(emAndamento && transicaoServico('PENDENTE', 'REALIZAR', ator, statusParada).ok);
    expect(acoes.naoRealizarServico).toBe(
      emAndamento && transicaoServico('PENDENTE', 'NAO_REALIZAR', ator, statusParada).ok,
    );
  });
});

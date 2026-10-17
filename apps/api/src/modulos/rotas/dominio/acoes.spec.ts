import { acoesAdminRota, StatusParada, StatusRota } from '@rotas/shared';
import { transicaoParada, transicaoRota } from './transicoes.js';

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

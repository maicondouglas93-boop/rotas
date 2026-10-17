import { StatusParada, StatusRota, StatusServico } from '@rotas/shared';
import {
  type Ator,
  COMANDOS_PARADA,
  COMANDOS_ROTA,
  COMANDOS_SERVICO,
  type ComandoParada,
  type ComandoRota,
  type ComandoServico,
  paradaDeveFinalizar,
  rotaDeveConcluir,
  transicaoParada,
  transicaoRota,
  transicaoServico,
} from './transicoes.js';

const TODOS_STATUS_ROTA = Object.values(StatusRota);
const TODOS_STATUS_PARADA = Object.values(StatusParada);
const TODOS_STATUS_SERVICO = Object.values(StatusServico);

const ATOR_CORRETO_ROTA: Record<ComandoRota, Ator> = {
  ENVIAR: 'ADMIN',
  CONFIRMAR_RECEBIMENTO: 'MOTORISTA_DA_ROTA',
  INICIAR: 'MOTORISTA_DA_ROTA',
  CONCLUIR: 'SISTEMA',
  CANCELAR: 'ADMIN',
  TRANSFERIR: 'ADMIN',
  EDITAR_ESTRUTURA: 'ADMIN',
  EXCLUIR: 'ADMIN',
};

const ATOR_CORRETO_PARADA: Record<ComandoParada, Ator> = {
  SEGUIR_PARA: 'MOTORISTA_DA_ROTA',
  VOLTAR_PARA_FILA: 'MOTORISTA_DA_ROTA',
  CHEGAR: 'MOTORISTA_DA_ROTA',
  CANCELAR_PARADA: 'ADMIN',
};

const ATOR_CORRETO_SERVICO: Record<ComandoServico, Ator> = {
  REALIZAR: 'MOTORISTA_DA_ROTA',
  NAO_REALIZAR: 'MOTORISTA_DA_ROTA',
};

type DestinoEsperado<T> = { permitido: true; destino: T } | { permitido: false };

describe('transicaoRota', () => {
  const esperadoRota: Record<StatusRota, Record<ComandoRota, DestinoEsperado<StatusRota | null>>> = {
    RASCUNHO: {
      ENVIAR: { permitido: true, destino: StatusRota.ENVIADA },
      CONFIRMAR_RECEBIMENTO: { permitido: false },
      INICIAR: { permitido: false },
      CONCLUIR: { permitido: false },
      CANCELAR: { permitido: true, destino: StatusRota.CANCELADA },
      TRANSFERIR: { permitido: false },
      EDITAR_ESTRUTURA: { permitido: true, destino: StatusRota.RASCUNHO },
      EXCLUIR: { permitido: true, destino: null },
    },
    ENVIADA: {
      ENVIAR: { permitido: false },
      CONFIRMAR_RECEBIMENTO: { permitido: true, destino: StatusRota.RECEBIDA },
      INICIAR: { permitido: false },
      CONCLUIR: { permitido: false },
      CANCELAR: { permitido: true, destino: StatusRota.CANCELADA },
      TRANSFERIR: { permitido: true, destino: StatusRota.ENVIADA },
      EDITAR_ESTRUTURA: { permitido: true, destino: StatusRota.ENVIADA },
      EXCLUIR: { permitido: false },
    },
    RECEBIDA: {
      ENVIAR: { permitido: false },
      CONFIRMAR_RECEBIMENTO: { permitido: false },
      INICIAR: { permitido: true, destino: StatusRota.EM_ANDAMENTO },
      CONCLUIR: { permitido: false },
      CANCELAR: { permitido: true, destino: StatusRota.CANCELADA },
      TRANSFERIR: { permitido: true, destino: StatusRota.ENVIADA },
      EDITAR_ESTRUTURA: { permitido: true, destino: StatusRota.ENVIADA },
      EXCLUIR: { permitido: false },
    },
    EM_ANDAMENTO: {
      ENVIAR: { permitido: false },
      CONFIRMAR_RECEBIMENTO: { permitido: false },
      INICIAR: { permitido: false },
      CONCLUIR: { permitido: true, destino: StatusRota.CONCLUIDA },
      CANCELAR: { permitido: true, destino: StatusRota.CANCELADA },
      TRANSFERIR: { permitido: true, destino: StatusRota.ENVIADA },
      EDITAR_ESTRUTURA: { permitido: true, destino: StatusRota.EM_ANDAMENTO },
      EXCLUIR: { permitido: false },
    },
    CONCLUIDA: {
      ENVIAR: { permitido: false },
      CONFIRMAR_RECEBIMENTO: { permitido: false },
      INICIAR: { permitido: false },
      CONCLUIR: { permitido: false },
      CANCELAR: { permitido: false },
      TRANSFERIR: { permitido: false },
      EDITAR_ESTRUTURA: { permitido: false },
      EXCLUIR: { permitido: false },
    },
    CANCELADA: {
      ENVIAR: { permitido: false },
      CONFIRMAR_RECEBIMENTO: { permitido: false },
      INICIAR: { permitido: false },
      CONCLUIR: { permitido: false },
      CANCELAR: { permitido: false },
      TRANSFERIR: { permitido: false },
      EDITAR_ESTRUTURA: { permitido: false },
      EXCLUIR: { permitido: false },
    },
  };

  const paresRota: [StatusRota, ComandoRota, DestinoEsperado<StatusRota | null>][] =
    TODOS_STATUS_ROTA.flatMap((status) =>
      COMANDOS_ROTA.map(
        (comando): [StatusRota, ComandoRota, DestinoEsperado<StatusRota | null>] => [
          status,
          comando,
          esperadoRota[status][comando],
        ],
      ),
    );

  it.each(paresRota)('status %s + comando %s => %o', (status, comando, esperado) => {
    const ator = ATOR_CORRETO_ROTA[comando];
    const resultado = transicaoRota(status, comando, ator);

    if (esperado.permitido) {
      expect(resultado).toEqual({ ok: true, valor: esperado.destino });
    } else {
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.motivo.length).toBeGreaterThan(0);
      }
    }
  });

  it.each<[ComandoRota, StatusRota, Ator]>([
    ['ENVIAR', StatusRota.RASCUNHO, 'MOTORISTA_DA_ROTA'],
    ['ENVIAR', StatusRota.RASCUNHO, 'SISTEMA'],
    ['CONFIRMAR_RECEBIMENTO', StatusRota.ENVIADA, 'ADMIN'],
    ['INICIAR', StatusRota.RECEBIDA, 'ADMIN'],
    ['CONCLUIR', StatusRota.EM_ANDAMENTO, 'ADMIN'],
    ['CONCLUIR', StatusRota.EM_ANDAMENTO, 'MOTORISTA_DA_ROTA'],
    ['CANCELAR', StatusRota.EM_ANDAMENTO, 'MOTORISTA_DA_ROTA'],
    ['TRANSFERIR', StatusRota.ENVIADA, 'MOTORISTA_DA_ROTA'],
    ['EDITAR_ESTRUTURA', StatusRota.ENVIADA, 'MOTORISTA_DA_ROTA'],
    ['EXCLUIR', StatusRota.RASCUNHO, 'MOTORISTA_DA_ROTA'],
  ])('rejeita comando %s em %s quando executado por ator incorreto (%s)', (comando, status, atorIncorreto) => {
    const resultado = transicaoRota(status, comando, atorIncorreto);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.motivo.length).toBeGreaterThan(0);
    }
  });
});

describe('transicaoParada', () => {
  const esperadoParadaComRotaEmAndamento: Record<
    StatusParada,
    Record<ComandoParada, DestinoEsperado<StatusParada>>
  > = {
    PENDENTE: {
      SEGUIR_PARA: { permitido: true, destino: StatusParada.A_CAMINHO },
      VOLTAR_PARA_FILA: { permitido: false },
      CHEGAR: { permitido: false },
      CANCELAR_PARADA: { permitido: true, destino: StatusParada.CANCELADA },
    },
    A_CAMINHO: {
      SEGUIR_PARA: { permitido: false },
      VOLTAR_PARA_FILA: { permitido: true, destino: StatusParada.PENDENTE },
      CHEGAR: { permitido: true, destino: StatusParada.NO_LOCAL },
      CANCELAR_PARADA: { permitido: true, destino: StatusParada.CANCELADA },
    },
    NO_LOCAL: {
      SEGUIR_PARA: { permitido: false },
      VOLTAR_PARA_FILA: { permitido: false },
      CHEGAR: { permitido: false },
      CANCELAR_PARADA: { permitido: false },
    },
    FINALIZADA: {
      SEGUIR_PARA: { permitido: false },
      VOLTAR_PARA_FILA: { permitido: false },
      CHEGAR: { permitido: false },
      CANCELAR_PARADA: { permitido: false },
    },
    CANCELADA: {
      SEGUIR_PARA: { permitido: false },
      VOLTAR_PARA_FILA: { permitido: false },
      CHEGAR: { permitido: false },
      CANCELAR_PARADA: { permitido: false },
    },
  };

  const paresParada: [StatusParada, ComandoParada, DestinoEsperado<StatusParada>][] =
    TODOS_STATUS_PARADA.flatMap((status) =>
      COMANDOS_PARADA.map(
        (comando): [StatusParada, ComandoParada, DestinoEsperado<StatusParada>] => [
          status,
          comando,
          esperadoParadaComRotaEmAndamento[status][comando],
        ],
      ),
    );

  it.each(paresParada)(
    'com rota EM_ANDAMENTO: parada %s + comando %s => %o',
    (status, comando, esperado) => {
      const ator = ATOR_CORRETO_PARADA[comando];
      const resultado = transicaoParada(status, comando, ator, StatusRota.EM_ANDAMENTO);

      if (esperado.permitido) {
        expect(resultado).toEqual({ ok: true, valor: esperado.destino });
      } else {
        expect(resultado.ok).toBe(false);
        if (!resultado.ok) {
          expect(resultado.motivo.length).toBeGreaterThan(0);
        }
      }
    },
  );

  it.each<[StatusRota, boolean]>([
    [StatusRota.RASCUNHO, false],
    [StatusRota.ENVIADA, false],
    [StatusRota.RECEBIDA, false],
    [StatusRota.EM_ANDAMENTO, true],
    [StatusRota.CONCLUIDA, false],
    [StatusRota.CANCELADA, false],
  ])('comandos do motorista na parada com rota %s => permitido=%s', (statusRota, permitido) => {
    expect(
      transicaoParada(StatusParada.PENDENTE, 'SEGUIR_PARA', 'MOTORISTA_DA_ROTA', statusRota).ok,
    ).toBe(permitido);
    expect(
      transicaoParada(StatusParada.A_CAMINHO, 'VOLTAR_PARA_FILA', 'MOTORISTA_DA_ROTA', statusRota).ok,
    ).toBe(permitido);
    expect(transicaoParada(StatusParada.A_CAMINHO, 'CHEGAR', 'MOTORISTA_DA_ROTA', statusRota).ok).toBe(
      permitido,
    );
  });

  it.each<[StatusRota, boolean]>([
    [StatusRota.RASCUNHO, false],
    [StatusRota.ENVIADA, false],
    [StatusRota.RECEBIDA, false],
    [StatusRota.EM_ANDAMENTO, true],
    [StatusRota.CONCLUIDA, false],
    [StatusRota.CANCELADA, false],
  ])('CANCELAR_PARADA com rota %s => permitido=%s', (statusRota, permitido) => {
    expect(transicaoParada(StatusParada.PENDENTE, 'CANCELAR_PARADA', 'ADMIN', statusRota).ok).toBe(
      permitido,
    );
  });

  it.each<[ComandoParada, StatusParada, Ator]>([
    ['SEGUIR_PARA', StatusParada.PENDENTE, 'ADMIN'],
    ['VOLTAR_PARA_FILA', StatusParada.A_CAMINHO, 'ADMIN'],
    ['CHEGAR', StatusParada.A_CAMINHO, 'SISTEMA'],
    ['CANCELAR_PARADA', StatusParada.PENDENTE, 'MOTORISTA_DA_ROTA'],
  ])('rejeita comando %s quando executado por ator incorreto (%s)', (comando, status, atorIncorreto) => {
    const resultado = transicaoParada(status, comando, atorIncorreto, StatusRota.EM_ANDAMENTO);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.motivo.length).toBeGreaterThan(0);
    }
  });
});

describe('transicaoServico', () => {
  const esperadoServicoParadaNoLocal: Record<
    StatusServico,
    Record<ComandoServico, DestinoEsperado<StatusServico>>
  > = {
    PENDENTE: {
      REALIZAR: { permitido: true, destino: StatusServico.REALIZADO },
      NAO_REALIZAR: { permitido: true, destino: StatusServico.NAO_REALIZADO },
    },
    REALIZADO: {
      REALIZAR: { permitido: false },
      NAO_REALIZAR: { permitido: false },
    },
    NAO_REALIZADO: {
      REALIZAR: { permitido: false },
      NAO_REALIZAR: { permitido: false },
    },
    CANCELADO: {
      REALIZAR: { permitido: false },
      NAO_REALIZAR: { permitido: false },
    },
  };

  const paresServico: [StatusServico, ComandoServico, DestinoEsperado<StatusServico>][] =
    TODOS_STATUS_SERVICO.flatMap((status) =>
      COMANDOS_SERVICO.map(
        (comando): [StatusServico, ComandoServico, DestinoEsperado<StatusServico>] => [
          status,
          comando,
          esperadoServicoParadaNoLocal[status][comando],
        ],
      ),
    );

  it.each(paresServico)(
    'com parada NO_LOCAL: serviço %s + comando %s => %o',
    (status, comando, esperado) => {
      const ator = ATOR_CORRETO_SERVICO[comando];
      const resultado = transicaoServico(status, comando, ator, StatusParada.NO_LOCAL);

      if (esperado.permitido) {
        expect(resultado).toEqual({ ok: true, valor: esperado.destino });
      } else {
        expect(resultado.ok).toBe(false);
        if (!resultado.ok) {
          expect(resultado.motivo.length).toBeGreaterThan(0);
        }
      }
    },
  );

  it.each<[StatusParada, ComandoServico, boolean]>([
    [StatusParada.PENDENTE, 'REALIZAR', false],
    [StatusParada.A_CAMINHO, 'REALIZAR', false],
    [StatusParada.NO_LOCAL, 'REALIZAR', true],
    [StatusParada.FINALIZADA, 'REALIZAR', false],
    [StatusParada.CANCELADA, 'REALIZAR', false],
    [StatusParada.PENDENTE, 'NAO_REALIZAR', false],
    [StatusParada.A_CAMINHO, 'NAO_REALIZAR', true],
    [StatusParada.NO_LOCAL, 'NAO_REALIZAR', true],
    [StatusParada.FINALIZADA, 'NAO_REALIZAR', false],
    [StatusParada.CANCELADA, 'NAO_REALIZAR', false],
  ])('serviço PENDENTE com parada %s + comando %s => permitido=%s', (statusParada, comando, permitido) => {
    const resultado = transicaoServico(
      StatusServico.PENDENTE,
      comando,
      'MOTORISTA_DA_ROTA',
      statusParada,
    );
    expect(resultado.ok).toBe(permitido);
  });

  it.each<[ComandoServico, Ator]>([
    ['REALIZAR', 'ADMIN'],
    ['REALIZAR', 'SISTEMA'],
    ['NAO_REALIZAR', 'ADMIN'],
    ['NAO_REALIZAR', 'SISTEMA'],
  ])('rejeita comando %s quando executado por ator incorreto (%s)', (comando, atorIncorreto) => {
    const resultado = transicaoServico(
      StatusServico.PENDENTE,
      comando,
      atorIncorreto,
      StatusParada.NO_LOCAL,
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.motivo.length).toBeGreaterThan(0);
    }
  });
});

describe('paradaDeveFinalizar', () => {
  it('retorna false quando a lista de serviços está vazia', () => {
    expect(paradaDeveFinalizar([])).toBe(false);
  });

  it('retorna false quando há serviços pendentes misturados com terminais', () => {
    expect(paradaDeveFinalizar([StatusServico.PENDENTE])).toBe(false);
    expect(paradaDeveFinalizar([StatusServico.REALIZADO, StatusServico.PENDENTE])).toBe(false);
    expect(paradaDeveFinalizar([StatusServico.NAO_REALIZADO, StatusServico.PENDENTE])).toBe(false);
  });

  it('retorna true quando todos os serviços estão em status terminal', () => {
    expect(paradaDeveFinalizar([StatusServico.REALIZADO])).toBe(true);
    expect(paradaDeveFinalizar([StatusServico.NAO_REALIZADO])).toBe(true);
    expect(paradaDeveFinalizar([StatusServico.CANCELADO])).toBe(true);
    expect(
      paradaDeveFinalizar([
        StatusServico.REALIZADO,
        StatusServico.NAO_REALIZADO,
        StatusServico.CANCELADO,
      ]),
    ).toBe(true);
  });
});

describe('rotaDeveConcluir', () => {
  it('retorna false quando a lista de paradas está vazia', () => {
    expect(rotaDeveConcluir([])).toBe(false);
  });

  it('retorna false quando há paradas não terminais', () => {
    expect(rotaDeveConcluir([StatusParada.PENDENTE])).toBe(false);
    expect(rotaDeveConcluir([StatusParada.FINALIZADA, StatusParada.A_CAMINHO])).toBe(false);
    expect(rotaDeveConcluir([StatusParada.FINALIZADA, StatusParada.NO_LOCAL])).toBe(false);
    expect(rotaDeveConcluir([StatusParada.CANCELADA, StatusParada.PENDENTE])).toBe(false);
  });

  it('retorna true quando todas as paradas estão em status terminal', () => {
    expect(rotaDeveConcluir([StatusParada.FINALIZADA])).toBe(true);
    expect(rotaDeveConcluir([StatusParada.CANCELADA])).toBe(true);
    expect(rotaDeveConcluir([StatusParada.FINALIZADA, StatusParada.CANCELADA])).toBe(true);
  });
});

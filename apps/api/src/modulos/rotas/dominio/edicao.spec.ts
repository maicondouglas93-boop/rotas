import type { StatusParada, TipoServico } from '@rotas/shared';
import { planejarEdicaoParadas, validarCamposEdicao, validarEnvio, type ParadaAtual } from './edicao.js';

const E1 = 'empresa-1';
const E2 = 'empresa-2';
const E3 = 'empresa-3';

function parada(id: string, status: StatusParada = 'PENDENTE', servicos: TipoServico[] = ['ENTREGA'], empresaId = E1): ParadaAtual {
  return { id, empresaId, status, servicos, observacoes: null };
}

describe('planejarEdicaoParadas', () => {
  it('em rascunho remove, adiciona, reordena e troca serviços', () => {
    const atuais = [parada('p1'), parada('p2', 'PENDENTE', ['COLETA'], E2), parada('p3', 'PENDENTE', ['ENTREGA'], E3)];
    const r = planejarEdicaoParadas('RASCUNHO', atuais, [
      { id: 'p3', empresaId: E3, servicos: ['ENTREGA'] },
      { empresaId: E1, servicos: ['COLETA', 'ENTREGA'], observacoes: 'Portão azul' },
      { id: 'p2', empresaId: E2, servicos: ['COLETA', 'ENTREGA'] },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.removidas).toEqual(['p1']);
    expect(r.valor.novas).toEqual([{ empresaId: E1, servicos: ['COLETA', 'ENTREGA'], observacoes: 'Portão azul' }]);
    expect(r.valor.ordem).toEqual([{ id: 'p3' }, { nova: 0 }, { id: 'p2' }]);
    expect(r.valor.reordenou).toBe(true);
    expect(r.valor.mantidas.find((m) => m.id === 'p2')).toEqual({
      id: 'p2',
      servicosAdicionar: ['ENTREGA'],
      servicosRemover: [],
      observacoes: undefined,
    });
  });

  it('não marca reordenação quando só acrescenta no fim', () => {
    const r = planejarEdicaoParadas('ENVIADA', [parada('p1'), parada('p2')], [
      { id: 'p1', empresaId: E1, servicos: ['ENTREGA'] },
      { id: 'p2', empresaId: E1, servicos: ['ENTREGA'] },
      { empresaId: E2, servicos: ['COLETA'] },
    ]);
    expect(r.ok && r.valor.reordenou).toBe(false);
  });

  it('recusa parada de outra rota e troca de empresa', () => {
    expect(planejarEdicaoParadas('RASCUNHO', [parada('p1')], [{ id: 'x', empresaId: E1, servicos: ['ENTREGA'] }]).ok).toBe(
      false,
    );
    const troca = planejarEdicaoParadas('RASCUNHO', [parada('p1')], [{ id: 'p1', empresaId: E2, servicos: ['ENTREGA'] }]);
    expect(troca).toMatchObject({ ok: false, motivo: expect.stringContaining('trocar a empresa') });
  });

  it('recusa rota concluída ou cancelada', () => {
    expect(planejarEdicaoParadas('CONCLUIDA', [], []).ok).toBe(false);
    expect(planejarEdicaoParadas('CANCELADA', [], []).ok).toBe(false);
  });

  describe('rota em andamento', () => {
    const atuais = [
      parada('fin', 'FINALIZADA'),
      parada('ativa', 'A_CAMINHO', ['COLETA'], E2),
      parada('pend1', 'PENDENTE', ['ENTREGA'], E3),
      parada('pend2', 'PENDENTE'),
    ];
    const manter = (id: string) => {
      const a = atuais.find((p) => p.id === id)!;
      return { id, empresaId: a.empresaId, servicos: [...a.servicos] };
    };

    it('permite adicionar e reordenar só as pendentes', () => {
      const r = planejarEdicaoParadas('EM_ANDAMENTO', atuais, [
        manter('fin'),
        manter('ativa'),
        manter('pend2'),
        { empresaId: E1, servicos: ['COLETA'] },
        manter('pend1'),
      ]);
      expect(r.ok).toBe(true);
      expect(r.ok && r.valor.reordenou).toBe(true);
    });

    it('não remove parada (exige cancelamento)', () => {
      const r = planejarEdicaoParadas('EM_ANDAMENTO', atuais, [manter('fin'), manter('ativa'), manter('pend1')]);
      expect(r).toMatchObject({ ok: false, motivo: expect.stringContaining('cancele a parada') });
    });

    it('não muda a ordem relativa das paradas já iniciadas', () => {
      const r = planejarEdicaoParadas('EM_ANDAMENTO', atuais, [manter('ativa'), manter('fin'), manter('pend1'), manter('pend2')]);
      expect(r).toMatchObject({ ok: false, motivo: expect.stringContaining('ordem') });
    });

    it('não muda serviços de parada iniciada, mas muda de pendente', () => {
      const mudaAtiva = planejarEdicaoParadas('EM_ANDAMENTO', atuais, [
        manter('fin'),
        { ...manter('ativa'), servicos: ['COLETA', 'ENTREGA'] },
        manter('pend1'),
        manter('pend2'),
      ]);
      expect(mudaAtiva.ok).toBe(false);
      const mudaPendente = planejarEdicaoParadas('EM_ANDAMENTO', atuais, [
        manter('fin'),
        manter('ativa'),
        { ...manter('pend1'), servicos: ['COLETA'] },
        manter('pend2'),
      ]);
      expect(mudaPendente.ok).toBe(true);
    });

    it('não muda observação de parada finalizada, mas muda da que está a caminho', () => {
      expect(
        planejarEdicaoParadas('EM_ANDAMENTO', atuais, [
          { ...manter('fin'), observacoes: 'nova' },
          manter('ativa'),
          manter('pend1'),
          manter('pend2'),
        ]).ok,
      ).toBe(false);
      expect(
        planejarEdicaoParadas('EM_ANDAMENTO', atuais, [
          manter('fin'),
          { ...manter('ativa'), observacoes: 'Ligar antes' },
          manter('pend1'),
          manter('pend2'),
        ]).ok,
      ).toBe(true);
    });
  });
});

describe('validarCamposEdicao', () => {
  const atual = { dataPrevista: '2026-10-20', motoristaId: 'm1' };

  it('troca de motorista só em rascunho', () => {
    expect(validarCamposEdicao('RASCUNHO', atual, { ...atual, motoristaId: 'm2' }).ok).toBe(true);
    expect(validarCamposEdicao('ENVIADA', atual, { ...atual, motoristaId: 'm2' }).ok).toBe(false);
  });

  it('data não muda com a rota em andamento', () => {
    expect(validarCamposEdicao('RECEBIDA', atual, { ...atual, dataPrevista: '2026-10-21' }).ok).toBe(true);
    expect(validarCamposEdicao('EM_ANDAMENTO', atual, { ...atual, dataPrevista: '2026-10-21' }).ok).toBe(false);
  });
});

describe('validarEnvio', () => {
  const ok = { nomeEmpresa: 'Mercado', quantidadeServicos: 1, empresaArquivada: false };

  it.each([
    [{ motoristaAtivo: null, paradas: [ok] }, 'Defina o motorista'],
    [{ motoristaAtivo: false, paradas: [ok] }, 'desativado'],
    [{ motoristaAtivo: true, paradas: [] }, 'ao menos uma parada'],
    [{ motoristaAtivo: true, paradas: [{ ...ok, quantidadeServicos: 0 }] }, 'ao menos um serviço'],
    [{ motoristaAtivo: true, paradas: [{ ...ok, empresaArquivada: true }] }, 'Mercado está arquivada'],
  ])('recusa %o', (dados, trecho) => {
    expect(validarEnvio(dados)).toMatchObject({ ok: false, motivo: expect.stringContaining(trecho) });
  });

  it('aceita rota completa', () => {
    expect(validarEnvio({ motoristaAtivo: true, paradas: [ok] }).ok).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { criarRotaSchema, editarRotaSchema, filtroRotasSchema, MAXIMO_PARADAS_POR_ROTA } from './rotas.js';

const EMPRESA = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const PARADA = '9b2d3c1e-1111-4a2b-8c3d-0e1f2a3b4c5d';

describe('criarRotaSchema', () => {
  it('aceita rota sem paradas e aplica padrão', () => {
    expect(criarRotaSchema.parse({ nome: ' Centro ', dataPrevista: '2026-10-20' })).toEqual({
      nome: 'Centro',
      dataPrevista: '2026-10-20',
      paradas: [],
    });
  });

  it('rejeita data inexistente no calendário', () => {
    expect(criarRotaSchema.safeParse({ nome: 'Centro', dataPrevista: '2026-02-30' }).success).toBe(false);
    expect(criarRotaSchema.safeParse({ nome: 'Centro', dataPrevista: '20/10/2026' }).success).toBe(false);
  });

  it('exige ao menos um serviço e recusa serviço repetido', () => {
    const base = { nome: 'Centro', dataPrevista: '2026-10-20' };
    expect(criarRotaSchema.safeParse({ ...base, paradas: [{ empresaId: EMPRESA, servicos: [] }] }).success).toBe(false);
    expect(
      criarRotaSchema.safeParse({ ...base, paradas: [{ empresaId: EMPRESA, servicos: ['COLETA', 'COLETA'] }] }).success,
    ).toBe(false);
    expect(
      criarRotaSchema.parse({ ...base, paradas: [{ empresaId: EMPRESA, servicos: ['COLETA', 'ENTREGA'] }] }).paradas,
    ).toHaveLength(1);
  });

  it('recusa id em parada de rota nova e campos extras', () => {
    const base = { nome: 'Centro', dataPrevista: '2026-10-20' };
    expect(
      criarRotaSchema.safeParse({ ...base, paradas: [{ id: PARADA, empresaId: EMPRESA, servicos: ['COLETA'] }] }).success,
    ).toBe(false);
    expect(criarRotaSchema.safeParse({ ...base, status: 'ENVIADA' }).success).toBe(false);
  });

  it(`limita a ${MAXIMO_PARADAS_POR_ROTA} paradas`, () => {
    const paradas = Array.from({ length: MAXIMO_PARADAS_POR_ROTA + 1 }, () => ({ empresaId: EMPRESA, servicos: ['ENTREGA'] }));
    expect(criarRotaSchema.safeParse({ nome: 'Centro', dataPrevista: '2026-10-20', paradas }).success).toBe(false);
  });

  it('observação vazia vira null', () => {
    const r = criarRotaSchema.parse({
      nome: 'Centro',
      dataPrevista: '2026-10-20',
      paradas: [{ empresaId: EMPRESA, servicos: ['ENTREGA'], observacoes: '  ' }],
    });
    expect(r.paradas[0]!.observacoes).toBeNull();
  });
});

describe('editarRotaSchema', () => {
  it('exige versão e recusa a mesma parada duas vezes', () => {
    const base = { nome: 'Centro', dataPrevista: '2026-10-20', motoristaId: null };
    expect(editarRotaSchema.safeParse({ ...base, paradas: [] }).success).toBe(false);
    const repetida = { id: PARADA, empresaId: EMPRESA, servicos: ['ENTREGA'] };
    expect(editarRotaSchema.safeParse({ ...base, versao: 1, paradas: [repetida, repetida] }).success).toBe(false);
    expect(editarRotaSchema.safeParse({ ...base, versao: 1, paradas: [repetida] }).success).toBe(true);
  });
});

describe('filtroRotasSchema', () => {
  it('separa a lista de status da query string', () => {
    expect(filtroRotasSchema.parse({ status: 'ENVIADA, RECEBIDA' }).status).toEqual(['ENVIADA', 'RECEBIDA']);
    expect(filtroRotasSchema.safeParse({ status: 'ENVIADA,QUALQUER' }).success).toBe(false);
  });

  it('recusa intervalo de datas invertido', () => {
    expect(filtroRotasSchema.safeParse({ dataDe: '2026-10-21', dataAte: '2026-10-20' }).success).toBe(false);
    expect(filtroRotasSchema.safeParse({ dataDe: '2026-10-20', dataAte: '2026-10-20' }).success).toBe(true);
  });
});

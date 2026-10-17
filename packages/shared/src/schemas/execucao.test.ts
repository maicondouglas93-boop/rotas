import { describe, expect, it } from 'vitest';
import {
  comandoMotoristaSchema,
  filtroRotasMotoristaSchema,
  naoRealizarServicoSchema,
  registrarOcorrenciaSchema,
} from './execucao.js';

describe('comandoMotoristaSchema', () => {
  it('aceita corpo vazio e horário com fuso', () => {
    expect(comandoMotoristaSchema.parse({})).toEqual({});
    expect(comandoMotoristaSchema.parse({ ocorridoEm: '2026-10-17T08:30:00-03:00' }).ocorridoEm).toBe(
      '2026-10-17T08:30:00-03:00',
    );
  });

  it('recusa horário inválido e campos extras', () => {
    expect(comandoMotoristaSchema.safeParse({ ocorridoEm: 'ontem' }).success).toBe(false);
    expect(comandoMotoristaSchema.safeParse({ status: 'CONCLUIDA' }).success).toBe(false);
  });
});

describe('ocorrências', () => {
  it('"Outro" exige descrição de 10 caracteres', () => {
    expect(registrarOcorrenciaSchema.safeParse({ tipo: 'OUTRO' }).success).toBe(false);
    expect(registrarOcorrenciaSchema.safeParse({ tipo: 'OUTRO', descricao: 'curta' }).success).toBe(false);
    expect(registrarOcorrenciaSchema.safeParse({ tipo: 'OUTRO', descricao: 'Portão trancado com cadeado' }).success).toBe(
      true,
    );
    expect(naoRealizarServicoSchema.safeParse({ tipoOcorrencia: 'OUTRO', descricao: '   ' }).success).toBe(false);
  });

  it('demais tipos dispensam descrição', () => {
    expect(naoRealizarServicoSchema.parse({ tipoOcorrencia: 'CLIENTE_AUSENTE' })).toEqual({
      tipoOcorrencia: 'CLIENTE_AUSENTE',
    });
  });
});

describe('filtroRotasMotoristaSchema', () => {
  it('padrão são as rotas abertas e nunca rascunho', () => {
    expect(filtroRotasMotoristaSchema.parse({}).status).toEqual(['ENVIADA', 'RECEBIDA', 'EM_ANDAMENTO']);
    expect(filtroRotasMotoristaSchema.parse({ status: 'CONCLUIDA' }).status).toEqual(['CONCLUIDA']);
    expect(filtroRotasMotoristaSchema.safeParse({ status: 'RASCUNHO' }).success).toBe(false);
  });
});

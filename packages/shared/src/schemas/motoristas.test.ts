import { describe, expect, it } from 'vitest';
import { atualizarMotoristaSchema, criarMotoristaSchema, filtroMotoristasSchema } from './motoristas.js';

const valido = { nome: '  Marcos Lima ', email: ' Marcos@Exemplo.COM ', telefone: '(11) 98765-4321' };

describe('criarMotoristaSchema', () => {
  it('normaliza nome, e-mail e telefone', () => {
    expect(criarMotoristaSchema.parse(valido)).toEqual({
      nome: 'Marcos Lima',
      email: 'marcos@exemplo.com',
      telefone: '+5511987654321',
    });
  });

  it('rejeita telefone e e-mail inválidos com mensagens em português', () => {
    const r = criarMotoristaSchema.safeParse({ ...valido, email: 'sem-arroba', telefone: '123' });
    expect(r.success).toBe(false);
    const mensagens = r.error!.issues.map((i) => i.message);
    expect(mensagens).toContain('E-mail inválido.');
    expect(mensagens).toContain('Telefone inválido.');
  });

  it('rejeita nome curto', () => {
    expect(criarMotoristaSchema.safeParse({ ...valido, nome: 'A' }).success).toBe(false);
  });

  it('rejeita campos não declarados, como senha ou perfil', () => {
    expect(criarMotoristaSchema.safeParse({ ...valido, senha: 'Escolhida123' }).success).toBe(false);
    expect(criarMotoristaSchema.safeParse({ ...valido, perfil: 'ADMIN' }).success).toBe(false);
  });
});

describe('atualizarMotoristaSchema', () => {
  it('aceita atualização parcial normalizada', () => {
    expect(atualizarMotoristaSchema.parse({ telefone: '11 3333-4444' })).toEqual({ telefone: '+551133334444' });
  });

  it('exige ao menos um campo', () => {
    expect(atualizarMotoristaSchema.safeParse({}).success).toBe(false);
  });
});

describe('filtroMotoristasSchema', () => {
  it('aplica padrões e converte incluirDesativados', () => {
    expect(filtroMotoristasSchema.parse({})).toEqual({ pagina: 1, porPagina: 20, incluirDesativados: false });
    expect(filtroMotoristasSchema.parse({ incluirDesativados: 'true', busca: '  marcos ' })).toMatchObject({
      incluirDesativados: true,
      busca: 'marcos',
    });
  });

  it('trata busca vazia como ausente e rejeita campo extra', () => {
    expect(filtroMotoristasSchema.parse({ busca: '   ' }).busca).toBeUndefined();
    expect(filtroMotoristasSchema.safeParse({ ordem: 'nome' }).success).toBe(false);
  });
});

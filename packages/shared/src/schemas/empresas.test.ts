import { describe, expect, it } from 'vitest';
import {
  atualizarEmpresaSchema,
  criarEmpresaSchema,
  filtroEmpresasSchema,
  mascararDocumento,
} from './empresas.js';

const baseValida = {
  nomeFantasia: '  Padaria Central  ',
  telefone: '(11) 98765-4321',
  logradouro: '  Rua São Bento ',
  numero: ' 100 ',
  bairro: ' Centro ',
  cidade: ' São Paulo ',
  uf: ' sp ',
  cep: '01011-100',
};

describe('criarEmpresaSchema', () => {
  it('normaliza strings, documento, telefones, UF e CEP', () => {
    const resultado = criarEmpresaSchema.parse({
      ...baseValida,
      razaoSocial: '  Padaria Central Ltda ',
      documento: '12.345.678/0001-90',
      whatsapp: '11 91234-5678',
      complemento: '   ',
      responsavel: '',
      horarioFuncionamento: ' Seg a Sex 8h-18h ',
      observacoes: '   ',
      latitude: -23.55052,
      longitude: -46.633309,
    });

    expect(resultado).toEqual({
      nomeFantasia: 'Padaria Central',
      razaoSocial: 'Padaria Central Ltda',
      documento: '12345678000190',
      telefone: '+5511987654321',
      whatsapp: '+5511912345678',
      logradouro: 'Rua São Bento',
      numero: '100',
      complemento: undefined,
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01011100',
      latitude: -23.55052,
      longitude: -46.633309,
      responsavel: undefined,
      horarioFuncionamento: 'Seg a Sex 8h-18h',
      observacoes: undefined,
    });
  });

  it('aceita CPF pontuado e transforma string vazia de documento/whatsapp em undefined', () => {
    const comCpf = criarEmpresaSchema.parse({ ...baseValida, documento: '123.456.789-01' });
    expect(comCpf.documento).toBe('12345678901');

    const vazios = criarEmpresaSchema.parse({ ...baseValida, documento: '  ', whatsapp: '' });
    expect(vazios.documento).toBeUndefined();
    expect(vazios.whatsapp).toBeUndefined();
  });

  it('retorna erro "Telefone inválido." para telefone ou whatsapp inválidos', () => {
    const erroTel = criarEmpresaSchema.safeParse({ ...baseValida, telefone: '123' });
    expect(erroTel.success).toBe(false);
    if (!erroTel.success) {
      expect(erroTel.error.issues[0]?.message).toBe('Telefone inválido.');
    }

    const erroWhats = criarEmpresaSchema.safeParse({ ...baseValida, whatsapp: 'invalido' });
    expect(erroWhats.success).toBe(false);
    if (!erroWhats.success) {
      expect(erroWhats.error.issues[0]?.message).toBe('Telefone inválido.');
    }
  });

  it('rejeita documento, UF, CEP e limites de tamanho inválidos', () => {
    expect(criarEmpresaSchema.safeParse({ ...baseValida, nomeFantasia: 'A' }).success).toBe(false);
    expect(criarEmpresaSchema.safeParse({ ...baseValida, documento: '12345' }).success).toBe(false);
    expect(criarEmpresaSchema.safeParse({ ...baseValida, uf: 'S1' }).success).toBe(false);
    expect(criarEmpresaSchema.safeParse({ ...baseValida, cep: '01011-10' }).success).toBe(false);
    expect(
      criarEmpresaSchema.safeParse({ ...baseValida, horarioFuncionamento: 'x'.repeat(201) }).success,
    ).toBe(false);
    expect(criarEmpresaSchema.safeParse({ ...baseValida, observacoes: 'x'.repeat(1001) }).success).toBe(
      false,
    );
  });

  it('rejeita quando apenas uma coordenada é informada ou está fora da faixa', () => {
    expect(criarEmpresaSchema.safeParse({ ...baseValida, latitude: -23.5 }).success).toBe(false);
    expect(criarEmpresaSchema.safeParse({ ...baseValida, longitude: -46.6 }).success).toBe(false);
    expect(criarEmpresaSchema.safeParse({ ...baseValida, latitude: -91, longitude: -46.6 }).success).toBe(
      false,
    );
    expect(criarEmpresaSchema.safeParse({ ...baseValida, latitude: -23.5, longitude: 181 }).success).toBe(
      false,
    );
  });

  it('rejeita campos extras (.strict())', () => {
    expect(criarEmpresaSchema.safeParse({ ...baseValida, arquivadaEm: null }).success).toBe(false);
  });
});

describe('atualizarEmpresaSchema', () => {
  it('aceita atualização parcial e null para remover opcionais', () => {
    const resultado = atualizarEmpresaSchema.parse({
      nomeFantasia: ' Novo Nome ',
      razaoSocial: null,
      documento: null,
      whatsapp: null,
      latitude: null,
      longitude: null,
    });

    expect(resultado.nomeFantasia).toBe('Novo Nome');
    expect(resultado.razaoSocial).toBeNull();
    expect(resultado.documento).toBeNull();
    expect(resultado.whatsapp).toBeNull();
    expect(resultado.latitude).toBeNull();
    expect(resultado.longitude).toBeNull();
  });

  it('converte string vazia em null nos campos opcionais e aceita { complemento: "" } isolado', () => {
    expect(atualizarEmpresaSchema.parse({ complemento: '' }).complemento).toBeNull();

    const limpos = atualizarEmpresaSchema.parse({
      razaoSocial: '   ',
      complemento: '',
      responsavel: ' ',
      horarioFuncionamento: '',
      observacoes: '  ',
      documento: '',
      whatsapp: '   ',
    });

    expect(limpos.razaoSocial).toBeNull();
    expect(limpos.complemento).toBeNull();
    expect(limpos.responsavel).toBeNull();
    expect(limpos.horarioFuncionamento).toBeNull();
    expect(limpos.observacoes).toBeNull();
    expect(limpos.documento).toBeNull();
    expect(limpos.whatsapp).toBeNull();
  });

  it('exige ao menos um campo e coordenadas pareadas', () => {
    expect(atualizarEmpresaSchema.safeParse({}).success).toBe(false);
    expect(atualizarEmpresaSchema.safeParse({ latitude: -23.5 }).success).toBe(false);
    expect(atualizarEmpresaSchema.safeParse({ latitude: -23.5, longitude: null }).success).toBe(false);
    expect(atualizarEmpresaSchema.safeParse({ nomeFantasia: 'Ok', extra: 1 }).success).toBe(false);
  });
});

describe('filtroEmpresasSchema', () => {
  it('aplica padrões de paginação e converte incluirArquivadas da query string', () => {
    expect(filtroEmpresasSchema.parse({})).toEqual({
      pagina: 1,
      porPagina: 20,
      busca: undefined,
      incluirArquivadas: false,
    });

    expect(
      filtroEmpresasSchema.parse({
        pagina: '2',
        porPagina: '10',
        busca: '  centro ',
        incluirArquivadas: 'true',
      }),
    ).toEqual({
      pagina: 2,
      porPagina: 10,
      busca: 'centro',
      incluirArquivadas: true,
    });

    expect(filtroEmpresasSchema.parse({ incluirArquivadas: 'false', busca: '   ' })).toEqual({
      pagina: 1,
      porPagina: 20,
      busca: undefined,
      incluirArquivadas: false,
    });
  });

  it('rejeita campo extra ou busca acima de 100 caracteres', () => {
    expect(filtroEmpresasSchema.safeParse({ extra: '1' }).success).toBe(false);
    expect(filtroEmpresasSchema.safeParse({ busca: 'a'.repeat(101) }).success).toBe(false);
  });
});

describe('mascararDocumento', () => {
  it('mascara CPF e CNPJ e devolve null quando ausente', () => {
    expect(mascararDocumento('12345678901')).toBe('***.456.789-**');
    expect(mascararDocumento('12345678000190')).toBe('**.345.678/0001-**');
    expect(mascararDocumento(null)).toBeNull();
  });
});

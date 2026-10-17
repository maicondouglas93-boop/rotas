import { describe, expect, it } from 'vitest';
import { CodigoErro } from '../api/erros.js';
import {
  loginSchema,
  refreshAppSchema,
  sessaoSchema,
  trocarSenhaSchema,
  usuarioSessaoSchema,
} from './auth.js';

describe('loginSchema', () => {
  it('normaliza o e-mail (trim e minúsculas) e preserva a senha', () => {
    const resultado = loginSchema.parse({
      email: '  Admin.Rotas@Exemplo.COM.br  ',
      senha: '  SenhaComEspaco123  ',
      cliente: 'painel',
    });

    expect(resultado).toEqual({
      email: 'admin.rotas@exemplo.com.br',
      senha: '  SenhaComEspaco123  ',
      cliente: 'painel',
    });
  });

  it('aceita cliente "app" e rejeita clientes desconhecidos', () => {
    expect(
      loginSchema.safeParse({
        email: 'motorista@rotas.local',
        senha: '123',
        cliente: 'app',
      }).success,
    ).toBe(true);

    expect(
      loginSchema.safeParse({
        email: 'motorista@rotas.local',
        senha: '123',
        cliente: 'web',
      }).success,
    ).toBe(false);
  });

  it('rejeita e-mail inválido ou maior que 254 caracteres', () => {
    expect(loginSchema.safeParse({ email: 'invalido', senha: '123', cliente: 'painel' }).success).toBe(
      false,
    );
    expect(loginSchema.safeParse({ email: '   ', senha: '123', cliente: 'painel' }).success).toBe(false);

    const emailLongo = `${'a'.repeat(245)}@exemplo.com`;
    expect(emailLongo.length).toBeGreaterThan(254);
    expect(loginSchema.safeParse({ email: emailLongo, senha: '123', cliente: 'painel' }).success).toBe(
      false,
    );
  });

  it('rejeita senha vazia, maior que 128 caracteres ou campos extras (.strict())', () => {
    expect(
      loginSchema.safeParse({ email: 'a@b.com', senha: '', cliente: 'painel' }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: 'a@b.com', senha: 'x'.repeat(129), cliente: 'painel' }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: 'a@b.com', senha: '123', cliente: 'painel', extra: true }).success,
    ).toBe(false);
  });
});

describe('refreshAppSchema', () => {
  it('valida refreshToken e remove espaços das extremidades', () => {
    expect(refreshAppSchema.parse({ refreshToken: '  token-opaco-123  ' })).toEqual({
      refreshToken: 'token-opaco-123',
    });
  });

  it('rejeita refreshToken vazio ou objeto com campo extra', () => {
    expect(refreshAppSchema.safeParse({ refreshToken: '   ' }).success).toBe(false);
    expect(refreshAppSchema.safeParse({ refreshToken: 'ok', extra: 1 }).success).toBe(false);
  });
});

describe('trocarSenhaSchema', () => {
  it('aceita senhaAtual (1-128) e novaSenha (8-128)', () => {
    const dados = trocarSenhaSchema.parse({
      senhaAtual: 'temp',
      novaSenha: 'NovaSenhaValida123!',
    });
    expect(dados.novaSenha).toBe('NovaSenhaValida123!');
  });

  it('rejeita novaSenha com menos de 8 ou mais de 128 caracteres e campos extras', () => {
    expect(
      trocarSenhaSchema.safeParse({ senhaAtual: 'temp', novaSenha: 'curta77' }).success,
    ).toBe(false);
    expect(
      trocarSenhaSchema.safeParse({ senhaAtual: 'temp', novaSenha: 'x'.repeat(129) }).success,
    ).toBe(false);
    expect(
      trocarSenhaSchema.safeParse({ senhaAtual: '', novaSenha: 'NovaSenhaValida123!' }).success,
    ).toBe(false);
    expect(
      trocarSenhaSchema.safeParse({
        senhaAtual: 'temp',
        novaSenha: 'NovaSenhaValida123!',
        perfil: 'ADMIN',
      }).success,
    ).toBe(false);
  });
});

describe('usuarioSessaoSchema e sessaoSchema', () => {
  const usuarioBase = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'admin@rotas.local',
    perfil: 'ADMIN' as const,
    nome: null,
    deveTrocarSenha: false,
  };

  it('aceita sessão do painel (sem refreshToken) e do app (com refreshToken)', () => {
    expect(usuarioSessaoSchema.parse(usuarioBase)).toEqual(usuarioBase);

    const sessaoPainel = sessaoSchema.parse({
      accessToken: 'jwt.token.aqui',
      expiraEm: '2026-10-16T23:00:00.000Z',
      usuario: usuarioBase,
    });
    expect(sessaoPainel.refreshToken).toBeUndefined();

    const sessaoApp = sessaoSchema.parse({
      accessToken: 'jwt.token.aqui',
      expiraEm: '2026-10-16T23:00:00.000Z',
      refreshToken: 'refresh-opaco',
      usuario: { ...usuarioBase, perfil: 'MOTORISTA', nome: 'João Motorista' },
    });
    expect(sessaoApp.refreshToken).toBe('refresh-opaco');
    expect(sessaoApp.usuario.nome).toBe('João Motorista');
  });

  it('rejeita data fora do formato ISO ou campos extras na sessão', () => {
    expect(
      sessaoSchema.safeParse({
        accessToken: 'jwt',
        expiraEm: 'data-invalida',
        usuario: usuarioBase,
      }).success,
    ).toBe(false);

    expect(
      sessaoSchema.safeParse({
        accessToken: 'jwt',
        expiraEm: '2026-10-16T23:00:00.000Z',
        usuario: { ...usuarioBase, senhaHash: 'vazou' },
      }).success,
    ).toBe(false);
  });

  it('inclui os códigos de erro de autenticação em CodigoErro', () => {
    expect(CodigoErro.TROCA_SENHA_OBRIGATORIA).toBe('TROCA_SENHA_OBRIGATORIA');
    expect(CodigoErro.MUITAS_TENTATIVAS).toBe('MUITAS_TENTATIVAS');
  });
});

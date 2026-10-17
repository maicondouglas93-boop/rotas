import { CodigoErro } from '@rotas/shared';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import { SenhasService } from './senhas.service.js';

describe('SenhasService', () => {
  const servico = new SenhasService();

  it('gera hash Argon2id e valida senha correta e incorreta', async () => {
    const hashGerado = await servico.gerarHash('SenhaForteValida!99');
    expect(hashGerado.startsWith('$argon2id$')).toBe(true);

    expect(await servico.verificar(hashGerado, 'SenhaForteValida!99')).toBe(true);
    expect(await servico.verificar(hashGerado, 'SenhaErrada!99')).toBe(false);
  });

  it('verifica contra hash falso quando o usuário não existe e devolve false', async () => {
    expect(await servico.verificar(null, 'qualquer-senha')).toBe(false);
    expect(await servico.verificar(null, 'senha-ficticia-para-tempo-constante-rotas')).toBe(false);
  });

  it('aceita nova senha que respeita a política', () => {
    expect(() =>
      servico.validarPoliticaNovaSenha('Senh@SeguraDeRota2026', 'motorista@rotas.local'),
    ).not.toThrow();
  });

  it('rejeita senha fora do intervalo de 8 a 128 caracteres', () => {
    expect(() => servico.validarPoliticaNovaSenha('curta12', 'a@b.com')).toThrowError(
      expect.objectContaining({
        codigo: CodigoErro.REGRA_NEGOCIO,
        message: 'A nova senha deve ter entre 8 e 128 caracteres.',
      }),
    );

    expect(() => servico.validarPoliticaNovaSenha('x'.repeat(129), 'a@b.com')).toThrowError(
      ErroDominio,
    );
  });

  it('rejeita senha igual ao e-mail sem diferenciar maiúsculas', () => {
    expect(() =>
      servico.validarPoliticaNovaSenha('Motorista@Rotas.Local', 'motorista@rotas.local'),
    ).toThrowError(
      expect.objectContaining({
        codigo: CodigoErro.REGRA_NEGOCIO,
        message: 'A nova senha não pode ser igual ao e-mail.',
      }),
    );
  });

  it.each(['12345678', 'senha123', 'SENHA123', 'password', 'qwerty123', 'admin123'])(
    'rejeita senha comum "%s" com REGRA_NEGOCIO',
    (senhaComum) => {
      expect(() => servico.validarPoliticaNovaSenha(senhaComum, 'usuario@rotas.local')).toThrowError(
        expect.objectContaining({
          codigo: CodigoErro.REGRA_NEGOCIO,
          message: 'Esta senha é muito comum. Escolha uma senha mais segura.',
        }),
      );
    },
  );
});

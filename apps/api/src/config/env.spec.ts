import { carregarEnv } from './env.js';

const URL_SECRETA = 'postgresql://usuario:senha-secreta@localhost:5432/rotas';

describe('carregarEnv', () => {
  it('aplica padrões e separa as origens do CORS', () => {
    const env = carregarEnv({ DATABASE_URL: URL_SECRETA, CORS_ORIGENS: 'http://a.test, http://b.test' });
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      LOG_LEVEL: 'log',
      CORS_ORIGENS: ['http://a.test', 'http://b.test'],
    });
  });

  it('falha citando o nome da variável ausente', () => {
    expect(() => carregarEnv({})).toThrow(/DATABASE_URL/);
  });

  it('não expõe o valor de variáveis inválidas na mensagem', () => {
    try {
      carregarEnv({ DATABASE_URL: URL_SECRETA, PORT: 'senha-secreta' });
      expect.unreachable();
    } catch (erro) {
      expect(String(erro)).toContain('PORT');
      expect(String(erro)).not.toContain('senha-secreta');
    }
  });

  it('rejeita URL que não é PostgreSQL', () => {
    expect(() => carregarEnv({ DATABASE_URL: 'mysql://u:p@localhost/x' })).toThrow(/DATABASE_URL/);
  });
});

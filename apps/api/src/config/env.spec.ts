import { carregarEnv } from './env.js';

const URL_SECRETA = 'postgresql://usuario:senha-secreta@localhost:5432/rotas';
const JWT_SECRETO = 'segredo-jwt-de-teste-com-pelo-menos-32-caracteres';

describe('carregarEnv', () => {
  it('aplica padrões e separa as origens do CORS', () => {
    const env = carregarEnv({
      DATABASE_URL: URL_SECRETA,
      JWT_SECRET: JWT_SECRETO,
      CORS_ORIGENS: 'http://a.test, http://b.test',
    });
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      LOG_LEVEL: 'log',
      CORS_ORIGENS: ['http://a.test', 'http://b.test'],
      JWT_ACCESS_MINUTOS: 15,
      REFRESH_DIAS: 30,
      LIMITE_LOGIN_POR_MINUTO: 5,
    });
    expect(env.COOKIE_DOMINIO).toBeUndefined();
  });

  it('falha citando o nome da variável ausente', () => {
    expect(() => carregarEnv({})).toThrow(/DATABASE_URL/);
    expect(() => carregarEnv({ DATABASE_URL: URL_SECRETA })).toThrow(/JWT_SECRET/);
  });

  it('rejeita JWT_SECRET com menos de 32 caracteres sem expor o valor', () => {
    const segredoCurto = 'segredo-curto-demais';
    try {
      carregarEnv({ DATABASE_URL: URL_SECRETA, JWT_SECRET: segredoCurto });
      expect.unreachable();
    } catch (erro) {
      expect(String(erro)).toContain('JWT_SECRET');
      expect(String(erro)).not.toContain(segredoCurto);
    }
  });

  it('não expõe o valor de variáveis inválidas na mensagem', () => {
    try {
      carregarEnv({ DATABASE_URL: URL_SECRETA, JWT_SECRET: JWT_SECRETO, PORT: 'senha-secreta' });
      expect.unreachable();
    } catch (erro) {
      expect(String(erro)).toContain('PORT');
      expect(String(erro)).not.toContain('senha-secreta');
    }
  });

  it('rejeita URL que não é PostgreSQL', () => {
    expect(() =>
      carregarEnv({ DATABASE_URL: 'mysql://u:p@localhost/x', JWT_SECRET: JWT_SECRETO }),
    ).toThrow(/DATABASE_URL/);
  });
});

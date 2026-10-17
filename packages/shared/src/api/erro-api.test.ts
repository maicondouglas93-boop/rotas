import { describe, expect, it } from 'vitest';
import { ErroApi } from './erro-api.js';

describe('ErroApi.daResposta', () => {
  it('lê código, mensagem e detalhes do envelope padrão', () => {
    const erro = ErroApi.daResposta(400, {
      erro: {
        codigo: 'VALIDACAO',
        mensagem: 'Dados inválidos.',
        detalhes: [{ caminho: 'nome', mensagem: 'Obrigatório' }],
        requestId: 'abc',
      },
    });
    expect(erro).toMatchObject({
      status: 400,
      codigo: 'VALIDACAO',
      message: 'Dados inválidos.',
      detalhes: [{ caminho: 'nome', mensagem: 'Obrigatório' }],
    });
  });

  it('usa ERRO_INTERNO quando o corpo não segue o envelope', () => {
    expect(ErroApi.daResposta(502, '<html>Bad Gateway</html>')).toMatchObject({
      status: 502,
      codigo: 'ERRO_INTERNO',
    });
  });

  it('cria o erro de falta de conexão', () => {
    expect(ErroApi.semConexao()).toMatchObject({ status: 0, codigo: 'SEM_CONEXAO' });
  });
});

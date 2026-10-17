import { respostaErroSchema, type CodigoErro, type DetalheErro } from './erros.js';

/** Erro de chamada à API como os clientes (painel e app) o enxergam. */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: CodigoErro | 'SEM_CONEXAO',
    mensagem: string,
    readonly detalhes: DetalheErro[] = [],
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }

  static semConexao(): ErroApi {
    return new ErroApi(0, 'SEM_CONEXAO', 'Não foi possível conectar à API. Verifique a conexão.');
  }

  /** Converte uma resposta não-2xx no ErroApi correspondente ao envelope padrão. */
  static daResposta(status: number, corpo: unknown): ErroApi {
    const envelope = respostaErroSchema.safeParse(corpo);
    if (envelope.success) {
      const { codigo, mensagem, detalhes } = envelope.data.erro;
      return new ErroApi(status, codigo, mensagem, detalhes);
    }
    return new ErroApi(status, 'ERRO_INTERNO', 'Resposta inesperada da API.');
  }
}

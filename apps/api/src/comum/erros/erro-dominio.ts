import { HttpStatus } from '@nestjs/common';
import { CodigoErro, type DetalheErro } from '@rotas/shared';
import type { z } from 'zod';

// Códigos e status HTTP conforme a tabela da skill nestjs-backend.
export class ErroDominio extends Error {
  constructor(
    readonly codigo: CodigoErro,
    readonly status: HttpStatus,
    mensagem: string,
    readonly detalhes: DetalheErro[] = [],
  ) {
    super(mensagem);
    this.name = 'ErroDominio';
  }

  static validacao(issues: z.core.$ZodIssue[]): ErroDominio {
    const detalhes = issues.map((issue) => ({
      caminho: issue.path.map(String).join('.'),
      mensagem: issue.message,
    }));
    return new ErroDominio(CodigoErro.VALIDACAO, HttpStatus.BAD_REQUEST, 'Dados inválidos.', detalhes);
  }

  static naoAutenticado(mensagem = 'Sessão inválida ou expirada. Entre novamente.'): ErroDominio {
    return new ErroDominio(CodigoErro.NAO_AUTENTICADO, HttpStatus.UNAUTHORIZED, mensagem);
  }

  static semPermissao(mensagem = 'Você não tem permissão para esta ação.'): ErroDominio {
    return new ErroDominio(CodigoErro.SEM_PERMISSAO, HttpStatus.FORBIDDEN, mensagem);
  }

  static trocaSenhaObrigatoria(mensagem = 'Troque sua senha para continuar.'): ErroDominio {
    return new ErroDominio(CodigoErro.TROCA_SENHA_OBRIGATORIA, HttpStatus.FORBIDDEN, mensagem);
  }

  static naoEncontrado(mensagem = 'Registro não encontrado.'): ErroDominio {
    return new ErroDominio(CodigoErro.NAO_ENCONTRADO, HttpStatus.NOT_FOUND, mensagem);
  }

  static transicaoInvalida(mensagem: string): ErroDominio {
    return new ErroDominio(CodigoErro.TRANSICAO_INVALIDA, HttpStatus.CONFLICT, mensagem);
  }

  static conflitoVersao(): ErroDominio {
    return new ErroDominio(
      CodigoErro.CONFLITO_VERSAO,
      HttpStatus.CONFLICT,
      'Este registro foi alterado por outra pessoa. Carregue a versão atual.',
    );
  }

  static regraNegocio(mensagem: string): ErroDominio {
    return new ErroDominio(CodigoErro.REGRA_NEGOCIO, HttpStatus.UNPROCESSABLE_ENTITY, mensagem);
  }
}

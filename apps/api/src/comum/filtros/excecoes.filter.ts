import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { CodigoErro, type RespostaErro } from '@rotas/shared';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { ErroDominio } from '../erros/erro-dominio.js';

type Convertido = { status: number; codigo: CodigoErro; mensagem: string; detalhes: RespostaErro['erro']['detalhes'] };

const MENSAGEM_INTERNA = 'Ocorreu um erro inesperado. Tente novamente em instantes.';

/** Converte qualquer exceção HTTP no envelope de erro padrão (nestjs-backend). */
@Catch()
export class ExcecoesFilter implements ExceptionFilter {
  private readonly logger = new Logger('Excecoes');

  catch(excecao: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const { status, codigo, mensagem, detalhes } = converter(excecao);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Só método, rota e stack: nunca corpo, cabeçalhos ou query (auth-security-lgpd).
      this.logger.error({
        requestId: req.requestId,
        metodo: req.method,
        rota: req.route?.path ?? req.path,
        erro: excecao instanceof Error ? excecao.stack : String(excecao),
      });
    }

    const corpo: RespostaErro = { erro: { codigo, mensagem, detalhes, requestId: req.requestId } };
    res.status(status).json(corpo);
  }
}

function converter(excecao: unknown): Convertido {
  if (excecao instanceof ErroDominio) {
    return { status: excecao.status, codigo: excecao.codigo, mensagem: excecao.message, detalhes: excecao.detalhes };
  }

  if (excecao instanceof Prisma.PrismaClientKnownRequestError) {
    switch (excecao.code) {
      case 'P2002':
        return erro(HttpStatus.CONFLICT, CodigoErro.REGISTRO_DUPLICADO, 'Já existe um registro com estes dados.');
      case 'P2025':
        return erro(HttpStatus.NOT_FOUND, CodigoErro.NAO_ENCONTRADO, 'Registro não encontrado.');
      case 'P2003':
        return erro(
          HttpStatus.UNPROCESSABLE_ENTITY,
          CodigoErro.REGRA_NEGOCIO,
          'O registro está ligado a outros dados e não pode ser alterado desta forma.',
        );
    }
  }

  if (excecao instanceof HttpException) {
    const status = excecao.getStatus();
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return erro(status, CodigoErro.NAO_AUTENTICADO, 'Sessão inválida ou expirada. Entre novamente.');
      case HttpStatus.FORBIDDEN:
        return erro(status, CodigoErro.SEM_PERMISSAO, 'Você não tem permissão para esta ação.');
      case HttpStatus.NOT_FOUND:
        return erro(status, CodigoErro.NAO_ENCONTRADO, 'Recurso não encontrado.');
      case HttpStatus.TOO_MANY_REQUESTS:
        return erro(
          status,
          CodigoErro.MUITAS_TENTATIVAS,
          'Muitas tentativas. Aguarde um minuto e tente novamente.',
        );
    }
    if (status < HttpStatus.INTERNAL_SERVER_ERROR) {
      return erro(status, CodigoErro.VALIDACAO, 'Requisição inválida.');
    }
  }

  return erro(HttpStatus.INTERNAL_SERVER_ERROR, CodigoErro.ERRO_INTERNO, MENSAGEM_INTERNA);
}

function erro(status: number, codigo: CodigoErro, mensagem: string): Convertido {
  return { status, codigo, mensagem, detalhes: [] };
}

import { createParamDecorator, Injectable, type ExecutionContext } from '@nestjs/common';
import { CABECALHO_IDEMPOTENCIA, chaveIdempotenciaSchema } from '@rotas/shared';
import type { Request } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ErroDominio } from '../erros/erro-dominio.js';

/** Lê e valida o cabeçalho `Idempotency-Key` (UUID). Ausente ou inválido → 400 VALIDACAO. */
export const ChaveIdempotencia = createParamDecorator((_dados: unknown, contexto: ExecutionContext): string => {
  const req = contexto.switchToHttp().getRequest<Request>();
  const resultado = chaveIdempotenciaSchema.safeParse(req.header(CABECALHO_IDEMPOTENCIA));
  if (!resultado.success) throw ErroDominio.validacao(resultado.error.issues);
  return resultado.data;
});

interface RespostaGravada {
  comando: string;
  resposta: unknown;
}

function lerGravada(corpo: Prisma.JsonValue): RespostaGravada | null {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) return null;
  const { comando, resposta } = corpo as Record<string, unknown>;
  return typeof comando === 'string' ? { comando, resposta } : null;
}

/**
 * Executa um comando do motorista uma única vez por `(usuario, chave)`.
 * A resposta é gravada na mesma transação do comando; repetir a chave devolve a resposta gravada.
 * `comando` identifica a ação (ex.: `cheguei:<paradaId>`) para recusar a mesma chave em outra ação.
 */
@Injectable()
export class IdempotenciaService {
  constructor(private readonly prisma: PrismaService) {}

  async executar<T>(
    usuarioId: string,
    chave: string,
    comando: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const anterior = await this.buscar(usuarioId, chave, comando);
    if (anterior !== undefined) return anterior as T;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const resposta = await fn(tx);
        await tx.comandoProcessado.create({
          data: {
            usuarioId,
            chave,
            statusHttp: 200,
            corpo: { comando, resposta } as unknown as Prisma.InputJsonValue,
          },
        });
        return resposta;
      });
    } catch (erro) {
      // Dois envios simultâneos da mesma chave: o segundo cai na chave primária e é desfeito.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        const gravada = await this.buscar(usuarioId, chave, comando);
        if (gravada !== undefined) return gravada as T;
      }
      throw erro;
    }
  }

  private async buscar(usuarioId: string, chave: string, comando: string): Promise<unknown> {
    const registro = await this.prisma.comandoProcessado.findUnique({
      where: { usuarioId_chave: { usuarioId, chave } },
      select: { corpo: true },
    });
    if (!registro) return undefined;
    const gravada = lerGravada(registro.corpo);
    if (!gravada || gravada.comando !== comando) {
      throw ErroDominio.regraNegocio('Esta chave de idempotência já foi usada em outro comando.');
    }
    return gravada.resposta;
  }
}

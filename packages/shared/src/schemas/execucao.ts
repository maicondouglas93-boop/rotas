import { z } from 'zod';
import { paginacaoSchema } from '../api/paginacao.js';
import { TipoOcorrencia, tipoOcorrenciaSchema } from '../dominio/historico.js';
import { statusRotaSchema } from '../dominio/status.js';

/** Cabeçalho obrigatório em todo comando do motorista (UUID gerado no toque, reaproveitado no reenvio). */
export const CABECALHO_IDEMPOTENCIA = 'idempotency-key';

export const idServicoSchema = z.uuid({ message: 'ID do serviço inválido.' });
export const chaveIdempotenciaSchema = z.uuid({ message: 'Cabeçalho Idempotency-Key ausente ou inválido (UUID).' });

/** Horário do dispositivo. É gravado no histórico, mas nunca decide regras de estado. */
const ocorridoEmSchema = z.iso.datetime({ offset: true, message: 'ocorridoEm deve ser data e hora ISO 8601.' }).optional();

export const comandoMotoristaSchema = z.object({ ocorridoEm: ocorridoEmSchema }).strict();
export type ComandoMotorista = z.infer<typeof comandoMotoristaSchema>;

const descricaoOcorrenciaSchema = z
  .string()
  .trim()
  .max(500, { message: 'A descrição deve ter no máximo 500 caracteres.' })
  .transform((v) => (v === '' ? undefined : v))
  .optional();

const MENSAGEM_DESCRICAO_OUTRO = 'Em "Outro", descreva a ocorrência (mínimo 10 caracteres).';

function descricaoSuficiente(tipo: TipoOcorrencia, descricao: string | undefined): boolean {
  return tipo !== TipoOcorrencia.OUTRO || (descricao?.length ?? 0) >= 10;
}

/** Ocorrência informativa na parada (não encerra serviço). */
export const registrarOcorrenciaSchema = z
  .object({ tipo: tipoOcorrenciaSchema, descricao: descricaoOcorrenciaSchema, ocorridoEm: ocorridoEmSchema })
  .strict()
  .refine((d) => descricaoSuficiente(d.tipo, d.descricao), { message: MENSAGEM_DESCRICAO_OUTRO, path: ['descricao'] });
export type RegistrarOcorrenciaEntrada = z.infer<typeof registrarOcorrenciaSchema>;

/** NAO_REALIZAR: a ocorrência é obrigatória e criada junto. */
export const naoRealizarServicoSchema = z
  .object({ tipoOcorrencia: tipoOcorrenciaSchema, descricao: descricaoOcorrenciaSchema, ocorridoEm: ocorridoEmSchema })
  .strict()
  .refine((d) => descricaoSuficiente(d.tipoOcorrencia, d.descricao), {
    message: MENSAGEM_DESCRICAO_OUTRO,
    path: ['descricao'],
  });
export type NaoRealizarServicoEntrada = z.infer<typeof naoRealizarServicoSchema>;

const listaStatusSchema = z
  .string()
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(z.array(statusRotaSchema.exclude(['RASCUNHO'])).min(1));

/** Rotas do próprio motorista. Padrão: as abertas (enviadas, recebidas e em andamento). */
export const filtroRotasMotoristaSchema = z
  .object({
    ...paginacaoSchema.shape,
    status: listaStatusSchema.default(['ENVIADA', 'RECEBIDA', 'EM_ANDAMENTO']),
  })
  .strict();
export type FiltroRotasMotorista = z.infer<typeof filtroRotasMotoristaSchema>;

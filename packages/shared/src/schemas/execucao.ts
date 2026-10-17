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

/** Tamanho máximo da foto do comprovante (JPEG já reduzido no app). */
export const LIMITE_FOTO_COMPROVANTE_BYTES = 1_500_000;

/**
 * Assinatura como traços no tamanho da área de desenho: cada traço é [x1, y1, x2, y2, …] em pixels
 * inteiros. Vetor pequeno, sem imagem; o painel desenha de novo em SVG.
 */
export const assinaturaSchema = z
  .object({
    largura: z.number().int().min(50).max(4000),
    altura: z.number().int().min(50).max(4000),
    tracos: z
      .array(
        z
          .array(z.number().int().min(0).max(4000))
          .min(2)
          .max(4000)
          .refine((t) => t.length % 2 === 0, { message: 'Traço com coordenada incompleta.' }),
      )
      .min(1, { message: 'A assinatura está vazia.' })
      .max(300),
  })
  .strict();
export type Assinatura = z.infer<typeof assinaturaSchema>;

/** Comprovante enviado junto com "serviço realizado": foto, assinatura e/ou nome de quem recebeu. */
export const comprovanteEntradaSchema = z
  .object({
    nomeRecebedor: z.string().trim().min(2, { message: 'Nome de quem recebeu muito curto.' }).max(120).optional(),
    assinatura: assinaturaSchema.optional(),
    fotoJpegBase64: z
      .base64({ message: 'Foto inválida.' })
      .max(Math.ceil(LIMITE_FOTO_COMPROVANTE_BYTES / 3) * 4, { message: 'Foto grande demais.' })
      // Todo JPEG começa com FF D8 FF, que em base64 é "/9j/".
      .refine((v) => v.startsWith('/9j/'), { message: 'A foto precisa ser JPEG.' })
      .optional(),
  })
  .strict()
  .refine((c) => c.nomeRecebedor !== undefined || c.assinatura !== undefined || c.fotoJpegBase64 !== undefined, {
    message: 'Informe a foto, a assinatura ou o nome de quem recebeu.',
  });
export type ComprovanteEntrada = z.infer<typeof comprovanteEntradaSchema>;

/** REALIZAR: comprovante opcional, gravado na mesma transação do serviço. */
export const realizarServicoSchema = z
  .object({ ocorridoEm: ocorridoEmSchema, comprovante: comprovanteEntradaSchema.optional() })
  .strict();
export type RealizarServicoEntrada = z.infer<typeof realizarServicoSchema>;

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

import { z } from 'zod';
import { tipoOcorrenciaSchema } from '../dominio/historico.js';
import { statusParadaSchema, tipoServicoSchema } from '../dominio/status.js';
import { dataSchema, rotaResumoSchema } from './rotas.js';

/** `?data=AAAA-MM-DD`; sem data, vale o dia de hoje em America/Sao_Paulo. */
export const filtroPainelHojeSchema = z.object({ data: dataSchema.optional() }).strict();
export type FiltroPainelHoje = z.infer<typeof filtroPainelHojeSchema>;

/** Rota do dia com o que o acompanhamento precisa: onde o motorista está, ocorrências e última atividade. */
export const rotaDoDiaSchema = rotaResumoSchema
  .extend({
    /** Parada a caminho ou no local; `null` se o motorista ainda não saiu para nenhuma. */
    paradaAtual: z
      .object({ id: z.uuid(), nomeEmpresa: z.string(), status: statusParadaSchema })
      .strict()
      .nullable(),
    ocorrencias: z.number().int(),
    /** Último evento do histórico (qualquer ator); base do "sem atividade há X min". */
    ultimaAtividadeEm: z.iso.datetime().nullable(),
  })
  .strict();
export type RotaDoDia = z.infer<typeof rotaDoDiaSchema>;

/** Ocorrência do dia, já com rota, empresa e motorista para o painel listar sem outra consulta. */
export const ocorrenciaDoDiaSchema = z
  .object({
    id: z.uuid(),
    tipo: tipoOcorrenciaSchema,
    descricao: z.string().nullable(),
    ocorridaEm: z.iso.datetime(),
    /** Serviço não realizado junto com a ocorrência; `null` na ocorrência só informativa. */
    servicoTipo: tipoServicoSchema.nullable(),
    rotaId: z.uuid(),
    rotaNome: z.string(),
    paradaId: z.uuid(),
    nomeEmpresa: z.string(),
    motoristaNome: z.string(),
  })
  .strict();
export type OcorrenciaDoDia = z.infer<typeof ocorrenciaDoDiaSchema>;

export const painelHojeSchema = z
  .object({
    data: dataSchema,
    rotas: z.array(rotaDoDiaSchema),
    ocorrencias: z.array(ocorrenciaDoDiaSchema),
  })
  .strict();
export type PainelHoje = z.infer<typeof painelHojeSchema>;

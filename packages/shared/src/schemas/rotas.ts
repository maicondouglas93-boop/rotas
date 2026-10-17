import { z } from 'zod';
import { paginacaoSchema } from '../api/paginacao.js';
import { tipoEventoRotaSchema } from '../dominio/historico.js';
import {
  ordemOrigemSchema,
  statusParadaSchema,
  statusRotaSchema,
  statusServicoSchema,
  tipoServicoSchema,
} from '../dominio/status.js';
import { buscaSchema } from './campos.js';

export const MAXIMO_PARADAS_POR_ROTA = 100;

export const idRotaSchema = z.uuid({ message: 'ID da rota inválido.' });
export const idParadaSchema = z.uuid({ message: 'ID da parada inválido.' });

/** Data sem hora no formato AAAA-MM-DD, validada como data real do calendário. */
export const dataSchema = z.iso.date({ message: 'Data inválida. Use o formato AAAA-MM-DD.' });

const nomeRotaSchema = z
  .string()
  .trim()
  .min(2, { message: 'Informe o nome da rota (mínimo 2 caracteres).' })
  .max(120, { message: 'Nome da rota deve ter no máximo 120 caracteres.' });

const motivoSchema = z
  .string()
  .trim()
  .min(5, { message: 'Descreva o motivo (mínimo 5 caracteres).' })
  .max(500, { message: 'Motivo deve ter no máximo 500 caracteres.' });

const versaoSchema = z.number({ message: 'Informe a versão da rota.' }).int().min(1);

const observacoesParadaSchema = z
  .string()
  .trim()
  .max(1000, { message: 'Observações devem ter no máximo 1000 caracteres.' })
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const servicosSchema = z
  .array(tipoServicoSchema, { message: 'Informe os serviços da parada.' })
  .min(1, { message: 'A parada precisa de ao menos um serviço (coleta ou entrega).' })
  .max(2)
  .refine((tipos) => new Set(tipos).size === tipos.length, { message: 'Serviço repetido na mesma parada.' });

/** Parada na montagem. Sem `id` é uma parada nova; com `id` é uma parada existente da rota. */
export const paradaEntradaSchema = z
  .object({
    id: idParadaSchema.optional(),
    empresaId: z.uuid({ message: 'ID da empresa inválido.' }),
    servicos: servicosSchema,
    observacoes: observacoesParadaSchema,
  })
  .strict();
export type ParadaEntrada = z.infer<typeof paradaEntradaSchema>;

const paradasSchema = z
  .array(paradaEntradaSchema)
  .max(MAXIMO_PARADAS_POR_ROTA, { message: `A rota pode ter no máximo ${MAXIMO_PARADAS_POR_ROTA} paradas.` })
  .refine(
    (paradas) => {
      const ids = paradas.flatMap((p) => (p.id ? [p.id] : []));
      return new Set(ids).size === ids.length;
    },
    { message: 'A mesma parada aparece mais de uma vez.' },
  );

/** Cria a rota em RASCUNHO; a ordem do array é a ordem das paradas. */
export const criarRotaSchema = z
  .object({
    nome: nomeRotaSchema,
    dataPrevista: dataSchema,
    motoristaId: z.uuid({ message: 'ID do motorista inválido.' }).nullable().optional(),
    paradas: paradasSchema.default([]),
  })
  .strict()
  .refine((d) => d.paradas.every((p) => p.id === undefined), {
    message: 'Paradas de uma rota nova não têm id.',
    path: ['paradas'],
  });
export type CriarRotaEntrada = z.infer<typeof criarRotaSchema>;

/**
 * Edição da estrutura (comando EDITAR_ESTRUTURA): envia o estado desejado completo.
 * Paradas existentes ausentes da lista são removidas; a ordem do array vira a nova sequência.
 */
export const editarRotaSchema = z
  .object({
    versao: versaoSchema,
    nome: nomeRotaSchema,
    dataPrevista: dataSchema,
    motoristaId: z.uuid({ message: 'ID do motorista inválido.' }).nullable(),
    paradas: paradasSchema,
  })
  .strict();
export type EditarRotaEntrada = z.infer<typeof editarRotaSchema>;

export const comandoComVersaoSchema = z.object({ versao: versaoSchema }).strict();
export type ComandoComVersao = z.infer<typeof comandoComVersaoSchema>;

/** Versão vinda da query string (DELETE não leva corpo). */
export const versaoQuerySchema = z.object({ versao: z.coerce.number().int().min(1) }).strict();
export type VersaoQuery = z.infer<typeof versaoQuerySchema>;

export const cancelarSchema = z.object({ versao: versaoSchema, motivo: motivoSchema }).strict();
export type CancelarEntrada = z.infer<typeof cancelarSchema>;

export const transferirRotaSchema = z
  .object({
    versao: versaoSchema,
    motoristaId: z.uuid({ message: 'ID do motorista inválido.' }),
    motivo: motivoSchema,
  })
  .strict();
export type TransferirRotaEntrada = z.infer<typeof transferirRotaSchema>;

export const duplicarRotaSchema = z
  .object({
    nome: nomeRotaSchema.optional(),
    dataPrevista: dataSchema.optional(),
  })
  .strict();
export type DuplicarRotaEntrada = z.infer<typeof duplicarRotaSchema>;

const listaStatusRotaSchema = z
  .string()
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(z.array(statusRotaSchema).min(1));

export const filtroRotasSchema = z
  .object({
    ...paginacaoSchema.shape,
    busca: buscaSchema(100),
    status: listaStatusRotaSchema.optional(),
    motoristaId: z.uuid({ message: 'ID do motorista inválido.' }).optional(),
    dataDe: dataSchema.optional(),
    dataAte: dataSchema.optional(),
  })
  .strict()
  .refine((d) => !d.dataDe || !d.dataAte || d.dataDe <= d.dataAte, {
    message: 'A data inicial não pode ser depois da final.',
    path: ['dataDe'],
  });
export type FiltroRotas = z.infer<typeof filtroRotasSchema>;

// ---------- Respostas ----------

/** `ativo = false` quando o motorista foi desativado: o painel destaca a rota para transferir ou cancelar. */
const motoristaResumoSchema = z.object({ id: z.uuid(), nome: z.string(), ativo: z.boolean() }).strict();

export const servicoSchema = z
  .object({
    id: z.uuid(),
    tipo: tipoServicoSchema,
    status: statusServicoSchema,
    concluidoEm: z.iso.datetime().nullable(),
  })
  .strict();
export type Servico = z.infer<typeof servicoSchema>;

export const paradaSchema = z
  .object({
    id: z.uuid(),
    sequencia: z.number().int(),
    status: statusParadaSchema,
    empresaId: z.uuid(),
    nomeEmpresa: z.string(),
    enderecoFormatado: z.string(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    telefone: z.string().nullable(),
    whatsapp: z.string().nullable(),
    observacoes: z.string().nullable(),
    chegadaEm: z.iso.datetime().nullable(),
    finalizadaEm: z.iso.datetime().nullable(),
    servicos: z.array(servicoSchema),
  })
  .strict();
export type Parada = z.infer<typeof paradaSchema>;

const camposComunsRota = {
  id: z.uuid(),
  nome: z.string(),
  dataPrevista: dataSchema,
  status: statusRotaSchema,
  versao: z.number().int(),
  motorista: motoristaResumoSchema.nullable(),
  enviadaEm: z.iso.datetime().nullable(),
  concluidaEm: z.iso.datetime().nullable(),
  atualizadoEm: z.iso.datetime(),
};

export const rotaSchema = z
  .object({
    ...camposComunsRota,
    ordemOrigem: ordemOrigemSchema,
    distanciaEstimadaM: z.number().int().nullable(),
    duracaoEstimadaS: z.number().int().nullable(),
    recebidaEm: z.iso.datetime().nullable(),
    iniciadaEm: z.iso.datetime().nullable(),
    canceladaEm: z.iso.datetime().nullable(),
    motivoCancelamento: z.string().nullable(),
    rotaOrigemId: z.uuid().nullable(),
    criadoEm: z.iso.datetime(),
    paradas: z.array(paradaSchema),
  })
  .strict();
export type Rota = z.infer<typeof rotaSchema>;

export const rotaResumoSchema = z
  .object({
    ...camposComunsRota,
    totalParadas: z.number().int(),
    paradasConcluidas: z.number().int(),
  })
  .strict();
export type RotaResumo = z.infer<typeof rotaResumoSchema>;

export const rotaDuplicadaSchema = z
  .object({
    rota: rotaSchema,
    /** Empresas arquivadas que estavam na rota original e ficaram de fora da cópia. */
    empresasOmitidas: z.array(z.object({ empresaId: z.uuid(), nomeEmpresa: z.string() }).strict()),
  })
  .strict();
export type RotaDuplicada = z.infer<typeof rotaDuplicadaSchema>;

export const eventoRotaSchema = z
  .object({
    id: z.uuid(),
    tipo: tipoEventoRotaSchema,
    statusAnterior: z.string().nullable(),
    statusNovo: z.string().nullable(),
    autorUsuarioId: z.uuid().nullable(),
    dados: z.record(z.string(), z.unknown()),
    ocorridoEm: z.iso.datetime().nullable(),
    criadoEm: z.iso.datetime(),
  })
  .strict();
export type EventoRota = z.infer<typeof eventoRotaSchema>;

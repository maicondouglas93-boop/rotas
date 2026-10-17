import { z } from 'zod';
import { paginacaoSchema } from '../api/paginacao.js';
import { booleanoQuerySchema, buscaSchema, emailSchema, telefoneSchema } from './campos.js';

export const idMotoristaSchema = z.uuid({ message: 'ID do motorista inválido.' });

const nomeSchema = z
  .string()
  .trim()
  .min(2, { message: 'Informe o nome (mínimo 2 caracteres).' })
  .max(120, { message: 'Nome deve ter no máximo 120 caracteres.' });

/** A senha temporária é gerada pela API; o admin nunca a escolhe. */
export const criarMotoristaSchema = z
  .object({
    nome: nomeSchema,
    email: emailSchema,
    telefone: telefoneSchema,
  })
  .strict();
export type CriarMotoristaEntrada = z.infer<typeof criarMotoristaSchema>;

export const atualizarMotoristaSchema = z
  .object({
    nome: nomeSchema.optional(),
    email: emailSchema.optional(),
    telefone: telefoneSchema.optional(),
  })
  .strict()
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Informe ao menos um campo para atualização.',
  });
export type AtualizarMotoristaEntrada = z.infer<typeof atualizarMotoristaSchema>;

export const filtroMotoristasSchema = z
  .object({
    ...paginacaoSchema.shape,
    busca: buscaSchema(100),
    incluirDesativados: booleanoQuerySchema,
  })
  .strict();
export type FiltroMotoristas = z.infer<typeof filtroMotoristasSchema>;

export const motoristaSchema = z
  .object({
    id: z.uuid(),
    usuarioId: z.uuid(),
    nome: z.string(),
    email: z.string(),
    telefone: z.string(),
    /** `false` quando o motorista foi desativado (sem acesso ao app). */
    ativo: z.boolean(),
    desativadoEm: z.iso.datetime().nullable(),
    deveTrocarSenha: z.boolean(),
    criadoEm: z.iso.datetime(),
    atualizadoEm: z.iso.datetime(),
  })
  .strict();
export type Motorista = z.infer<typeof motoristaSchema>;

/** Resposta da criação: a senha temporária aparece só aqui, uma única vez. */
export const motoristaCriadoSchema = z
  .object({
    motorista: motoristaSchema,
    senhaTemporaria: z.string(),
  })
  .strict();
export type MotoristaCriado = z.infer<typeof motoristaCriadoSchema>;

export const senhaRedefinidaSchema = z
  .object({
    senhaTemporaria: z.string(),
  })
  .strict();
export type SenhaRedefinida = z.infer<typeof senhaRedefinidaSchema>;

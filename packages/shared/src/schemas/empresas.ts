import { z } from 'zod';
import { paginacaoSchema } from '../api/paginacao.js';
import { fonteLocalizacaoSchema } from '../dominio/status.js';
import { normalizarTelefoneBR } from '../telefone.js';

const MENSAGEM_TELEFONE_INVALIDO = 'Telefone inválido.';
const MENSAGEM_DOCUMENTO_INVALIDO = 'Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).';
const MENSAGEM_COORDENADAS_JUNTAS = 'Latitude e longitude devem ser informadas juntas.';

function documentoValido(valor: string): boolean {
  const digitos = valor.replace(/\D/g, '');
  return digitos.length === 11 || digitos.length === 14;
}

function cepValido(valor: string): boolean {
  return /^\d{5}-?\d{3}$/.test(valor);
}

function textoObrigatorio(maximo: number, minimo = 1) {
  return z.string().trim().min(minimo).max(maximo);
}

function textoOpcional(maximo: number) {
  return z
    .string()
    .trim()
    .max(maximo)
    .transform((v) => (v === '' ? undefined : v))
    .optional();
}

function textoOpcionalAtualizacao(maximo: number) {
  return z
    .string()
    .trim()
    .max(maximo)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();
}

const telefoneObrigatorioSchema = z
  .string()
  .trim()
  .refine((v) => normalizarTelefoneBR(v) !== null, { message: MENSAGEM_TELEFONE_INVALIDO })
  .transform((v) => normalizarTelefoneBR(v) ?? v);

const whatsappOpcionalSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || normalizarTelefoneBR(v) !== null, { message: MENSAGEM_TELEFONE_INVALIDO })
  .transform((v) => (v === '' ? undefined : (normalizarTelefoneBR(v) ?? undefined)))
  .optional();

const whatsappAtualizacaoSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || normalizarTelefoneBR(v) !== null, { message: MENSAGEM_TELEFONE_INVALIDO })
  .transform((v) => (v === '' ? null : normalizarTelefoneBR(v)))
  .nullable()
  .optional();

const documentoOpcionalSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || documentoValido(v), { message: MENSAGEM_DOCUMENTO_INVALIDO })
  .transform((v) => (v === '' ? undefined : v.replace(/\D/g, '')))
  .optional();

const documentoAtualizacaoSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || documentoValido(v), { message: MENSAGEM_DOCUMENTO_INVALIDO })
  .transform((v) => (v === '' ? null : v.replace(/\D/g, '')))
  .nullable()
  .optional();

const ufSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z]{2}$/.test(v), { message: 'UF deve conter 2 letras.' });

const cepSchema = z
  .string()
  .trim()
  .refine(cepValido, { message: 'CEP inválido.' })
  .transform((v) => v.replace(/\D/g, ''));

const latitudeSchema = z.number().min(-90).max(90);
const longitudeSchema = z.number().min(-180).max(180);

export const idEmpresaSchema = z.uuid({ message: 'ID da empresa inválido.' });

export const criarEmpresaSchema = z
  .object({
    nomeFantasia: textoObrigatorio(120, 2),
    razaoSocial: textoOpcional(200),
    documento: documentoOpcionalSchema,
    telefone: telefoneObrigatorioSchema,
    whatsapp: whatsappOpcionalSchema,
    logradouro: textoObrigatorio(200),
    numero: textoObrigatorio(50),
    complemento: textoOpcional(200),
    bairro: textoObrigatorio(120),
    cidade: textoObrigatorio(120),
    uf: ufSchema,
    cep: cepSchema,
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
    responsavel: textoOpcional(120),
    horarioFuncionamento: textoOpcional(200),
    observacoes: textoOpcional(1000),
  })
  .strict()
  .refine((d) => (d.latitude !== undefined) === (d.longitude !== undefined), {
    message: MENSAGEM_COORDENADAS_JUNTAS,
    path: ['latitude'],
  });
export type CriarEmpresaEntrada = z.infer<typeof criarEmpresaSchema>;

export const atualizarEmpresaSchema = z
  .object({
    nomeFantasia: textoObrigatorio(120, 2).optional(),
    razaoSocial: textoOpcionalAtualizacao(200),
    documento: documentoAtualizacaoSchema,
    telefone: telefoneObrigatorioSchema.optional(),
    whatsapp: whatsappAtualizacaoSchema,
    logradouro: textoObrigatorio(200).optional(),
    numero: textoObrigatorio(50).optional(),
    complemento: textoOpcionalAtualizacao(200),
    bairro: textoObrigatorio(120).optional(),
    cidade: textoObrigatorio(120).optional(),
    uf: ufSchema.optional(),
    cep: cepSchema.optional(),
    latitude: latitudeSchema.nullable().optional(),
    longitude: longitudeSchema.nullable().optional(),
    responsavel: textoOpcionalAtualizacao(120),
    horarioFuncionamento: textoOpcionalAtualizacao(200),
    observacoes: textoOpcionalAtualizacao(1000),
  })
  .strict()
  .refine((d) => typeof d.latitude === typeof d.longitude, {
    message: MENSAGEM_COORDENADAS_JUNTAS,
    path: ['latitude'],
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Informe ao menos um campo para atualização.',
  });
export type AtualizarEmpresaEntrada = z.infer<typeof atualizarEmpresaSchema>;

export const filtroEmpresasSchema = z
  .object({
    ...paginacaoSchema.shape,
    busca: textoOpcional(100),
    incluirArquivadas: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .or(z.boolean())
      .default(false),
  })
  .strict();
export type FiltroEmpresas = z.infer<typeof filtroEmpresasSchema>;

export const empresaSchema = z
  .object({
    id: z.uuid(),
    nomeFantasia: z.string(),
    razaoSocial: z.string().nullable(),
    documentoMascarado: z.string().nullable(),
    telefone: z.string(),
    whatsapp: z.string().nullable(),
    logradouro: z.string(),
    numero: z.string(),
    complemento: z.string().nullable(),
    bairro: z.string(),
    cidade: z.string(),
    uf: z.string().length(2),
    cep: z.string().length(8),
    enderecoFormatado: z.string(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    fonteLocalizacao: fonteLocalizacaoSchema.nullable(),
    responsavel: z.string().nullable(),
    horarioFuncionamento: z.string().nullable(),
    observacoes: z.string().nullable(),
    arquivadaEm: z.iso.datetime().nullable(),
    criadoEm: z.iso.datetime(),
    atualizadoEm: z.iso.datetime(),
  })
  .strict();
export type Empresa = z.infer<typeof empresaSchema>;

/** Mascara CPF (`***.456.789-**`) ou CNPJ (`**.345.678/0001-**`). */
export function mascararDocumento(documento: string | null): string | null {
  if (documento === null) return null;
  const digitos = documento.replace(/\D/g, '');
  if (digitos.length === 11) {
    return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`;
  }
  if (digitos.length === 14) {
    return `**.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-**`;
  }
  return null;
}

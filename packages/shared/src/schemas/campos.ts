import { z } from 'zod';
import { normalizarTelefoneBR } from '../telefone.js';

// Campos reutilizados por mais de um schema (empresas, motoristas, auth).

export const MENSAGEM_TELEFONE_INVALIDO = 'Telefone inválido.';

/** E-mail com trim, em minúsculas e com até 254 caracteres. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { message: 'E-mail deve ter no máximo 254 caracteres.' })
  .pipe(z.email({ message: 'E-mail inválido.' }));

/** Telefone brasileiro obrigatório, normalizado para E.164 (+55DDDNUMERO). */
export const telefoneSchema = z
  .string()
  .trim()
  .refine((v) => normalizarTelefoneBR(v) !== null, { message: MENSAGEM_TELEFONE_INVALIDO })
  .transform((v) => normalizarTelefoneBR(v) ?? v);

/** Booleano vindo da query string (`'true'`/`'false'`), com padrão `false`. */
export const booleanoQuerySchema = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .or(z.boolean())
  .default(false);

/** Texto de busca opcional: trim, até `maximo` caracteres; vazio vira ausente. */
export function buscaSchema(maximo = 100) {
  return z
    .string()
    .trim()
    .max(maximo)
    .transform((v) => (v === '' ? undefined : v))
    .optional();
}

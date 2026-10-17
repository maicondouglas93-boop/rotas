import { z } from 'zod';
import { perfilUsuarioSchema } from '../dominio/status.js';

export const ClienteAuth = {
  PAINEL: 'painel',
  APP: 'app',
} as const;
export type ClienteAuth = (typeof ClienteAuth)[keyof typeof ClienteAuth];
export const clienteAuthSchema = z.enum(ClienteAuth);

const emailNormalizadoSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { message: 'E-mail deve ter no máximo 254 caracteres.' })
  .pipe(z.email({ message: 'E-mail inválido.' }));

export const loginSchema = z
  .object({
    email: emailNormalizadoSchema,
    senha: z
      .string()
      .min(1, { message: 'Informe a senha.' })
      .max(128, { message: 'Senha deve ter no máximo 128 caracteres.' }),
    cliente: clienteAuthSchema,
  })
  .strict();
export type LoginEntrada = z.infer<typeof loginSchema>;

export const refreshAppSchema = z
  .object({
    refreshToken: z
      .string()
      .trim()
      .min(1, { message: 'Refresh token é obrigatório.' })
      .max(512, { message: 'Refresh token inválido.' }),
  })
  .strict();
export type RefreshAppEntrada = z.infer<typeof refreshAppSchema>;

export const trocarSenhaSchema = z
  .object({
    senhaAtual: z
      .string()
      .min(1, { message: 'Informe a senha atual.' })
      .max(128, { message: 'Senha atual deve ter no máximo 128 caracteres.' }),
    novaSenha: z
      .string()
      .min(8, { message: 'A nova senha deve ter no mínimo 8 caracteres.' })
      .max(128, { message: 'A nova senha deve ter no máximo 128 caracteres.' }),
  })
  .strict();
export type TrocarSenhaEntrada = z.infer<typeof trocarSenhaSchema>;

export const usuarioSessaoSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    perfil: perfilUsuarioSchema,
    nome: z.string().nullable(),
    deveTrocarSenha: z.boolean(),
  })
  .strict();
export type UsuarioSessao = z.infer<typeof usuarioSessaoSchema>;

export const sessaoSchema = z
  .object({
    accessToken: z.string().min(1),
    expiraEm: z.iso.datetime(),
    refreshToken: z.string().min(1).optional(),
    usuario: usuarioSessaoSchema,
  })
  .strict();
export type Sessao = z.infer<typeof sessaoSchema>;

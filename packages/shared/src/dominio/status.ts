import { z } from 'zod';

// Valores definidos em .claude/skills/delivery-domain-rules. O Prisma espelha estes enums.

export const PerfilUsuario = {
  ADMIN: 'ADMIN',
  MOTORISTA: 'MOTORISTA',
} as const;
export type PerfilUsuario = (typeof PerfilUsuario)[keyof typeof PerfilUsuario];
export const perfilUsuarioSchema = z.enum(PerfilUsuario);

export const StatusRota = {
  RASCUNHO: 'RASCUNHO',
  ENVIADA: 'ENVIADA',
  RECEBIDA: 'RECEBIDA',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  CONCLUIDA: 'CONCLUIDA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusRota = (typeof StatusRota)[keyof typeof StatusRota];
export const statusRotaSchema = z.enum(StatusRota);

export const StatusParada = {
  PENDENTE: 'PENDENTE',
  A_CAMINHO: 'A_CAMINHO',
  NO_LOCAL: 'NO_LOCAL',
  FINALIZADA: 'FINALIZADA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusParada = (typeof StatusParada)[keyof typeof StatusParada];
export const statusParadaSchema = z.enum(StatusParada);

export const TipoServico = {
  COLETA: 'COLETA',
  ENTREGA: 'ENTREGA',
} as const;
export type TipoServico = (typeof TipoServico)[keyof typeof TipoServico];
export const tipoServicoSchema = z.enum(TipoServico);

export const StatusServico = {
  PENDENTE: 'PENDENTE',
  REALIZADO: 'REALIZADO',
  NAO_REALIZADO: 'NAO_REALIZADO',
  CANCELADO: 'CANCELADO',
} as const;
export type StatusServico = (typeof StatusServico)[keyof typeof StatusServico];
export const statusServicoSchema = z.enum(StatusServico);

export const OrdemOrigem = {
  MANUAL: 'MANUAL',
  SUGESTAO_PROXIMIDADE: 'SUGESTAO_PROXIMIDADE',
  OTIMIZADA_PROVEDOR: 'OTIMIZADA_PROVEDOR',
} as const;
export type OrdemOrigem = (typeof OrdemOrigem)[keyof typeof OrdemOrigem];
export const ordemOrigemSchema = z.enum(OrdemOrigem);

export const FonteLocalizacao = {
  GEOCODIFICADA: 'GEOCODIFICADA',
  MANUAL: 'MANUAL',
} as const;
export type FonteLocalizacao = (typeof FonteLocalizacao)[keyof typeof FonteLocalizacao];
export const fonteLocalizacaoSchema = z.enum(FonteLocalizacao);

export const PrecisaoLocalizacao = {
  EXATA: 'EXATA',
  APROXIMADA: 'APROXIMADA',
} as const;
export type PrecisaoLocalizacao = (typeof PrecisaoLocalizacao)[keyof typeof PrecisaoLocalizacao];
export const precisaoLocalizacaoSchema = z.enum(PrecisaoLocalizacao);

export const STATUS_ROTA_TERMINAIS: readonly StatusRota[] = [StatusRota.CONCLUIDA, StatusRota.CANCELADA];
export const STATUS_PARADA_TERMINAIS: readonly StatusParada[] = [StatusParada.FINALIZADA, StatusParada.CANCELADA];
export const STATUS_SERVICO_TERMINAIS: readonly StatusServico[] = [
  StatusServico.REALIZADO,
  StatusServico.NAO_REALIZADO,
  StatusServico.CANCELADO,
];

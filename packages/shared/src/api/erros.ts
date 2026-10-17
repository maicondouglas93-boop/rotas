import { z } from 'zod';

// Tabela de códigos em .claude/skills/nestjs-backend.
export const CodigoErro = {
  VALIDACAO: 'VALIDACAO',
  NAO_AUTENTICADO: 'NAO_AUTENTICADO',
  SEM_PERMISSAO: 'SEM_PERMISSAO',
  TROCA_SENHA_OBRIGATORIA: 'TROCA_SENHA_OBRIGATORIA',
  NAO_ENCONTRADO: 'NAO_ENCONTRADO',
  TRANSICAO_INVALIDA: 'TRANSICAO_INVALIDA',
  CONFLITO_VERSAO: 'CONFLITO_VERSAO',
  REGISTRO_DUPLICADO: 'REGISTRO_DUPLICADO',
  REGRA_NEGOCIO: 'REGRA_NEGOCIO',
  MUITAS_TENTATIVAS: 'MUITAS_TENTATIVAS',
  ERRO_INTERNO: 'ERRO_INTERNO',
} as const;
export type CodigoErro = (typeof CodigoErro)[keyof typeof CodigoErro];

export const detalheErroSchema = z.object({
  caminho: z.string(),
  mensagem: z.string(),
});
export type DetalheErro = z.infer<typeof detalheErroSchema>;

export const respostaErroSchema = z.object({
  erro: z.object({
    codigo: z.enum(CodigoErro),
    mensagem: z.string(),
    detalhes: z.array(detalheErroSchema),
    requestId: z.string().optional(),
  }),
});
export type RespostaErro = z.infer<typeof respostaErroSchema>;

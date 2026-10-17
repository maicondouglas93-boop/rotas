import { z } from 'zod';

export const POR_PAGINA_MAXIMO = 100;

export const paginacaoSchema = z
  .object({
    pagina: z.coerce.number().int().min(1).default(1),
    porPagina: z.coerce.number().int().min(1).max(POR_PAGINA_MAXIMO).default(20),
  })
  .strict();
export type Paginacao = z.infer<typeof paginacaoSchema>;

export type RespostaPaginada<T> = {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
};

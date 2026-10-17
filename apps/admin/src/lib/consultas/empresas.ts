'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { empresaSchema, type Empresa, type RespostaPaginada } from '@rotas/shared';
import { json, requisitar } from '../api';

export interface FiltroListaEmpresas {
  busca?: string;
  incluirArquivadas?: boolean;
  pagina: number;
  porPagina?: number;
}

export const chavesEmpresas = {
  todas: ['empresas'] as const,
  lista: (filtro: FiltroListaEmpresas) => ['empresas', 'lista', filtro] as const,
  detalhe: (id: string) => ['empresas', id] as const,
};

function consulta(filtro: FiltroListaEmpresas): string {
  const p = new URLSearchParams({ pagina: String(filtro.pagina), porPagina: String(filtro.porPagina ?? 20) });
  if (filtro.busca) p.set('busca', filtro.busca);
  if (filtro.incluirArquivadas) p.set('incluirArquivadas', 'true');
  return p.toString();
}

export function useEmpresas(filtro: FiltroListaEmpresas) {
  return useQuery({
    queryKey: chavesEmpresas.lista(filtro),
    queryFn: () => requisitar<RespostaPaginada<Empresa>>(`/empresas?${consulta(filtro)}`),
    placeholderData: keepPreviousData,
  });
}

export function useEmpresa(id: string) {
  return useQuery({
    queryKey: chavesEmpresas.detalhe(id),
    queryFn: async () => empresaSchema.parse(await requisitar(`/empresas/${id}`)),
  });
}

/** Corpo enviado à API: strings como digitadas (a API normaliza); coordenadas já em número. */
export type DadosEmpresa = Record<string, string | number | null | undefined>;

function useMutacaoEmpresa<T>(fn: (entrada: T) => Promise<Empresa>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (empresa) => {
      queryClient.setQueryData(chavesEmpresas.detalhe(empresa.id), empresa);
      return queryClient.invalidateQueries({ queryKey: [...chavesEmpresas.todas, 'lista'] });
    },
  });
}

export function useCriarEmpresa() {
  return useMutacaoEmpresa((dados: DadosEmpresa) => requisitar<Empresa>('/empresas', { method: 'POST', body: json(dados) }));
}

export function useAtualizarEmpresa(id: string) {
  return useMutacaoEmpresa((dados: DadosEmpresa) =>
    requisitar<Empresa>(`/empresas/${id}`, { method: 'PATCH', body: json(dados) }),
  );
}

export function useArquivarEmpresa() {
  return useMutacaoEmpresa((id: string) => requisitar<Empresa>(`/empresas/${id}/arquivar`, { method: 'POST' }));
}

export function useReativarEmpresa() {
  return useMutacaoEmpresa((id: string) => requisitar<Empresa>(`/empresas/${id}/reativar`, { method: 'POST' }));
}

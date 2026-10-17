'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  eventoRotaSchema,
  rotaDuplicadaSchema,
  rotaSchema,
  type Rota,
  type RotaResumo,
  type RespostaPaginada,
  type StatusRota,
  type TipoServico,
} from '@rotas/shared';
import { z } from 'zod';
import { json, requisitar } from '../api';

export interface FiltroListaRotas {
  busca?: string;
  status?: StatusRota[];
  data?: string;
  motoristaId?: string;
  pagina: number;
}

export const chavesRotas = {
  todas: ['rotas'] as const,
  lista: (filtro: FiltroListaRotas) => ['rotas', 'lista', filtro] as const,
  detalhe: (id: string) => ['rotas', id] as const,
  historico: (id: string) => ['rotas', id, 'historico'] as const,
};

export function useRotas(filtro: FiltroListaRotas) {
  const p = new URLSearchParams({ pagina: String(filtro.pagina), porPagina: '20' });
  if (filtro.busca) p.set('busca', filtro.busca);
  if (filtro.status?.length) p.set('status', filtro.status.join(','));
  if (filtro.data) {
    p.set('dataDe', filtro.data);
    p.set('dataAte', filtro.data);
  }
  if (filtro.motoristaId) p.set('motoristaId', filtro.motoristaId);
  return useQuery({
    queryKey: chavesRotas.lista(filtro),
    queryFn: () => requisitar<RespostaPaginada<RotaResumo>>(`/rotas?${p.toString()}`),
    placeholderData: keepPreviousData,
  });
}

export function useRota(id: string) {
  return useQuery({
    queryKey: chavesRotas.detalhe(id),
    queryFn: async () => rotaSchema.parse(await requisitar(`/rotas/${id}`)),
  });
}

export function useHistoricoRota(id: string) {
  return useQuery({
    queryKey: chavesRotas.historico(id),
    queryFn: async () => z.array(eventoRotaSchema).parse(await requisitar(`/rotas/${id}/historico`)),
  });
}

export interface ParadaMontagem {
  id?: string;
  empresaId: string;
  servicos: TipoServico[];
  observacoes: string;
}

export interface DadosMontagem {
  nome: string;
  dataPrevista: string;
  motoristaId: string | null;
  paradas: ParadaMontagem[];
}

/** Toda mudança numa rota devolve a rota inteira: atualiza o detalhe e invalida lista e histórico. */
function useMutacaoRota<T>(fn: (entrada: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: T) => rotaSchema.parse(await fn(entrada)),
    onSuccess: (rota: Rota) => {
      queryClient.setQueryData(chavesRotas.detalhe(rota.id), rota);
      void queryClient.invalidateQueries({ queryKey: chavesRotas.historico(rota.id) });
      return queryClient.invalidateQueries({ queryKey: [...chavesRotas.todas, 'lista'] });
    },
  });
}

export function useCriarRota() {
  return useMutacaoRota((dados: DadosMontagem) => requisitar('/rotas', { method: 'POST', body: json(dados) }));
}

export function useEditarRota(id: string) {
  return useMutacaoRota((dados: DadosMontagem & { versao: number }) =>
    requisitar(`/rotas/${id}`, { method: 'PUT', body: json(dados) }),
  );
}

export function useEnviarRota() {
  return useMutacaoRota(({ id, versao }: { id: string; versao: number }) =>
    requisitar(`/rotas/${id}/enviar`, { method: 'POST', body: json({ versao }) }),
  );
}

export function useCancelarRota() {
  return useMutacaoRota(({ id, versao, motivo }: { id: string; versao: number; motivo: string }) =>
    requisitar(`/rotas/${id}/cancelar`, { method: 'POST', body: json({ versao, motivo }) }),
  );
}

export function useTransferirRota() {
  return useMutacaoRota(
    ({ id, versao, motoristaId, motivo }: { id: string; versao: number; motoristaId: string; motivo: string }) =>
      requisitar(`/rotas/${id}/transferir`, { method: 'POST', body: json({ versao, motoristaId, motivo }) }),
  );
}

export function useCancelarParada() {
  return useMutacaoRota(
    ({ id, paradaId, versao, motivo }: { id: string; paradaId: string; versao: number; motivo: string }) =>
      requisitar(`/rotas/${id}/paradas/${paradaId}/cancelar`, { method: 'POST', body: json({ versao, motivo }) }),
  );
}

export function useDuplicarRota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dataPrevista }: { id: string; dataPrevista: string }) =>
      rotaDuplicadaSchema.parse(await requisitar(`/rotas/${id}/duplicar`, { method: 'POST', body: json({ dataPrevista }) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...chavesRotas.todas, 'lista'] }),
  });
}

export function useExcluirRota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, versao }: { id: string; versao: number }) =>
      requisitar<void>(`/rotas/${id}?versao=${versao}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...chavesRotas.todas, 'lista'] }),
  });
}

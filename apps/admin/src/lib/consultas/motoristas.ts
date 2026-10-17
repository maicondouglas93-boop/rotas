'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  motoristaCriadoSchema,
  motoristaSchema,
  senhaRedefinidaSchema,
  type Motorista,
  type RespostaPaginada,
} from '@rotas/shared';
import { json, requisitar } from '../api';

export interface FiltroListaMotoristas {
  busca?: string;
  incluirDesativados?: boolean;
  pagina: number;
  porPagina?: number;
}

export const chavesMotoristas = {
  todos: ['motoristas'] as const,
  lista: (filtro: FiltroListaMotoristas) => ['motoristas', 'lista', filtro] as const,
  detalhe: (id: string) => ['motoristas', id] as const,
};

export function useMotoristas(filtro: FiltroListaMotoristas) {
  const p = new URLSearchParams({ pagina: String(filtro.pagina), porPagina: String(filtro.porPagina ?? 20) });
  if (filtro.busca) p.set('busca', filtro.busca);
  if (filtro.incluirDesativados) p.set('incluirDesativados', 'true');
  return useQuery({
    queryKey: chavesMotoristas.lista(filtro),
    queryFn: () => requisitar<RespostaPaginada<Motorista>>(`/motoristas?${p.toString()}`),
    placeholderData: keepPreviousData,
  });
}

export function useMotorista(id: string) {
  return useQuery({
    queryKey: chavesMotoristas.detalhe(id),
    queryFn: async () => motoristaSchema.parse(await requisitar(`/motoristas/${id}`)),
  });
}

function useInvalidarMotoristas() {
  const queryClient = useQueryClient();
  return (motorista?: Motorista) => {
    if (motorista) queryClient.setQueryData(chavesMotoristas.detalhe(motorista.id), motorista);
    return queryClient.invalidateQueries({ queryKey: [...chavesMotoristas.todos, 'lista'] });
  };
}

export type DadosMotorista = { nome?: string; email?: string; telefone?: string };

export function useCriarMotorista() {
  const invalidar = useInvalidarMotoristas();
  return useMutation({
    mutationFn: async (dados: DadosMotorista) =>
      motoristaCriadoSchema.parse(await requisitar('/motoristas', { method: 'POST', body: json(dados) })),
    onSuccess: (criado) => invalidar(criado.motorista),
  });
}

export function useAtualizarMotorista(id: string) {
  const invalidar = useInvalidarMotoristas();
  return useMutation({
    mutationFn: async (dados: DadosMotorista) =>
      motoristaSchema.parse(await requisitar(`/motoristas/${id}`, { method: 'PATCH', body: json(dados) })),
    onSuccess: invalidar,
  });
}

function useComandoMotorista(acao: 'desativar' | 'reativar') {
  const invalidar = useInvalidarMotoristas();
  return useMutation({
    mutationFn: async (id: string) =>
      motoristaSchema.parse(await requisitar(`/motoristas/${id}/${acao}`, { method: 'POST' })),
    onSuccess: invalidar,
  });
}

export const useDesativarMotorista = () => useComandoMotorista('desativar');
export const useReativarMotorista = () => useComandoMotorista('reativar');

export function useRedefinirSenhaMotorista() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      senhaRedefinidaSchema.parse(await requisitar(`/motoristas/${id}/redefinir-senha`, { method: 'POST' })),
    onSuccess: (_resultado, id) => queryClient.invalidateQueries({ queryKey: chavesMotoristas.detalhe(id) }),
  });
}

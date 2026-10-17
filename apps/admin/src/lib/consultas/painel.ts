'use client';

import { useQuery } from '@tanstack/react-query';
import { painelHojeSchema } from '@rotas/shared';
import { requisitar } from '../api';
import { intervaloAcompanhamento, useEstadoTempoReal } from '../estado-tempo-real';

export const chavesPainel = {
  hoje: ['painel', 'hoje'] as const,
};

/** Visão do dia. Com o Socket.IO conectado, eventos invalidam a consulta; sem ele, recarrega a cada 30 s. */
export function usePainelHoje() {
  const conexao = useEstadoTempoReal();
  return useQuery({
    queryKey: chavesPainel.hoje,
    queryFn: async () => painelHojeSchema.parse(await requisitar('/painel/hoje')),
    refetchInterval: intervaloAcompanhamento(conexao, true),
  });
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rotaSchema, type RespostaPaginada, type Rota, type RotaResumo } from '@rotas/shared';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { assinarFila, enfileirar, lerFila, type NovoComando } from '../fila/fila-comandos';
import { projetarRota } from '../fila/projecao';
import { requisitar } from './cliente';

export const chaves = {
  rotas: (situacao: 'abertas' | 'concluidas') => ['motorista', 'rotas', situacao] as const,
  rota: (id: string) => ['motorista', 'rota', id] as const,
};

export function useMinhasRotas(situacao: 'abertas' | 'concluidas' = 'abertas') {
  const status = situacao === 'abertas' ? 'ENVIADA,RECEBIDA,EM_ANDAMENTO' : 'CONCLUIDA';
  return useQuery({
    queryKey: chaves.rotas(situacao),
    queryFn: () => requisitar<RespostaPaginada<RotaResumo>>(`/motorista/rotas?status=${status}&porPagina=50`),
  });
}

export function useRota(id: string) {
  return useQuery({
    queryKey: chaves.rota(id),
    queryFn: async () => rotaSchema.parse(await requisitar(`/motorista/rotas/${id}`)),
  });
}

/** Resposta de um comando: a rota inteira atualizada. Substitui o cache e revalida a lista. */
export function useAplicarRota() {
  const queryClient = useQueryClient();
  return useCallback(
    (rota: Rota) => {
      queryClient.setQueryData(chaves.rota(rota.id), rota);
      void queryClient.invalidateQueries({ queryKey: ['motorista', 'rotas'] });
    },
    [queryClient],
  );
}

/** Comandos ainda não confirmados pela API (para mostrar "aguardando envio"). */
export function useFilaPendente() {
  return useSyncExternalStore(assinarFila, lerFila, lerFila);
}

export function useEnviarComando() {
  return useCallback((comando: NovoComando) => enfileirar(comando), []);
}

/**
 * Rota como a tela deve mostrar: estado confirmado pelo servidor + comandos ainda na fila (para o
 * motorista seguir trabalhando sem sinal). `aguardando` tem os ids (rota, paradas, serviços) com
 * comando não confirmado, para a tela marcar "aguardando envio".
 */
export function useRotaProjetada(id: string) {
  const consulta = useRota(id);
  const pendentes = useFilaPendente();
  const rota = useMemo(
    () => (consulta.data ? projetarRota(consulta.data, pendentes) : undefined),
    [consulta.data, pendentes],
  );
  const aguardando = useMemo(
    () => new Set(pendentes.filter((c) => c.rotaId === id).map((c) => c.alvoId)),
    [pendentes, id],
  );
  return { consulta, rota, pendentes, aguardando };
}

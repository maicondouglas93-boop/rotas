'use client';

import { createContext, useContext } from 'react';

export type EstadoConexao = 'conectando' | 'ao-vivo' | 'reconectando';

/** Estado da conexão Socket.IO; fica fora de tempo-real.tsx para as consultas não importarem o provider. */
export const ContextoTempoReal = createContext<EstadoConexao>('conectando');

export function useEstadoTempoReal(): EstadoConexao {
  return useContext(ContextoTempoReal);
}

/** Sem conexão ao vivo, rotas em execução voltam a ser recarregadas a cada 30 s (admin-dashboard-ui). */
const INTERVALO_SEM_CONEXAO_MS = 30_000;

/** Intervalo de recarga de uma rota em execução: nenhum com conexão ao vivo, 30 s sem ela. */
export function intervaloAcompanhamento(estado: EstadoConexao, emExecucao: boolean): number | false {
  return emExecucao && estado !== 'ao-vivo' ? INTERVALO_SEM_CONEXAO_MS : false;
}

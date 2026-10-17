import type { Parada } from '@rotas/shared';

/** Parada em curso (a caminho ou no local) ou, se não houver, a primeira pendente na ordem da rota. */
export function proximaParada(paradas: Parada[], exceto?: string): Parada | undefined {
  const candidatas = paradas.filter((p) => p.id !== exceto);
  return (
    candidatas.find((p) => p.status === 'NO_LOCAL' || p.status === 'A_CAMINHO') ??
    candidatas.find((p) => p.status === 'PENDENTE')
  );
}

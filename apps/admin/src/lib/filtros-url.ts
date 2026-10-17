'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Filtros, página e busca ficam na URL: o botão voltar e o link compartilhado funcionam (admin-dashboard-ui).
 * `definir` substitui os valores informados; `undefined` ou '' remove o parâmetro e volta para a página 1.
 */
export function useFiltrosUrl() {
  const parametros = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();

  const ler = useCallback((nome: string) => parametros.get(nome) ?? undefined, [parametros]);

  const definir = useCallback(
    (valores: Record<string, string | number | boolean | undefined>) => {
      const novos = new URLSearchParams(parametros.toString());
      for (const [nome, valor] of Object.entries(valores)) {
        if (valor === undefined || valor === '' || valor === false) novos.delete(nome);
        else novos.set(nome, String(valor));
      }
      if (!('pagina' in valores)) novos.delete('pagina');
      const consulta = novos.toString();
      router.replace(consulta ? `${caminho}?${consulta}` : caminho, { scroll: false });
    },
    [parametros, router, caminho],
  );

  const pagina = Number(ler('pagina') ?? '1') || 1;
  return { ler, definir, pagina, parametros };
}

'use client';

import { useEffect, useState } from 'react';

/** Devolve o valor só depois de `atrasoMs` sem mudanças (busca enquanto digita). */
export function useDebounce<T>(valor: T, atrasoMs = 300): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), atrasoMs);
    return () => clearTimeout(t);
  }, [valor, atrasoMs]);
  return atrasado;
}

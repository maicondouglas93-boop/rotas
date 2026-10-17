'use client';

import { useEffect, useState } from 'react';

/** Hora atual que se atualiza sozinha (para textos como "há 12 min" não ficarem parados). */
export function useAgora(intervaloMs = 60_000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

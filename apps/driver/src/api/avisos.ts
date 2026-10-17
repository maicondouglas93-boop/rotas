import { useSyncExternalStore } from 'react';

/** Quanto tempo o aviso da administração fica na tela se o motorista não dispensar. */
export const DURACAO_AVISO_MS = 20_000;

let aviso: string | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;
const ouvintes = new Set<() => void>();

function notificar(): void {
  ouvintes.forEach((ouvinte) => ouvinte());
}

/** Mostra um aviso curto no topo das telas (substitui o anterior). */
export function publicarAviso(texto: string): void {
  aviso = texto;
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(dispensarAviso, DURACAO_AVISO_MS);
  notificar();
}

export function dispensarAviso(): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  if (aviso === null) return;
  aviso = null;
  notificar();
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

const ler = () => aviso;

export function useAvisoAdministracao(): string | null {
  return useSyncExternalStore(assinar, ler, ler);
}

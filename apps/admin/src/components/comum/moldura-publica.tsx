import { TruckIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Moldura das telas sem login (entrar, trocar senha): faixa com o gradiente da marca e cartão central. */
export function MolduraPublica({ titulo, descricao, children }: { titulo: string; descricao: ReactNode; children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-start justify-center overflow-hidden bg-background px-4 py-12 sm:items-center">
      <div aria-hidden className="gradiente-marca absolute inset-x-0 top-0 h-[44vh] min-h-72 rounded-b-[2.5rem]" />
      <div className="relative flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center text-white">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-white/20 bg-white/12">
            <TruckIcon className="size-7" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-3xl font-bold tracking-tight">Rotas</p>
            <p className="text-sm text-white/80">Coletas e entregas sob controle, parada a parada.</p>
          </div>
        </div>
        <div className="superficie flex flex-col gap-6 p-6 shadow-xl sm:p-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight">{titulo}</h1>
            <p className="text-sm text-muted-foreground">{descricao}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

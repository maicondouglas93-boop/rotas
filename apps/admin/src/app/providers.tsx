'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErroApi } from '@rotas/shared';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SessaoProvider } from '@/lib/sessao';

export function Providers({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            // Erros de regra (4xx) não melhoram tentando de novo; falha de rede sim.
            retry: (tentativas, erro) => tentativas < 2 && !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500),
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={cliente}>
      <SessaoProvider>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-right" richColors closeButton />
      </SessaoProvider>
    </QueryClientProvider>
  );
}

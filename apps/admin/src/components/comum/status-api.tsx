'use client';

import { useQuery } from '@tanstack/react-query';
import { requisitar } from '@/lib/api';

type Saude = { status: 'ok'; versao: string };

export function StatusApi() {
  const consulta = useQuery({
    queryKey: ['saude'],
    queryFn: () => requisitar<Saude>('/saude/pronto'),
    refetchInterval: 30_000,
  });

  if (consulta.isPending) {
    return <Indicador cor="bg-muted-foreground" texto="Verificando conexão com a API…" />;
  }
  if (consulta.isError) {
    return (
      <div className="flex items-center gap-3">
        <Indicador cor="bg-destructive" texto="API indisponível" />
        <button
          type="button"
          onClick={() => consulta.refetch()}
          className="text-sm font-medium underline underline-offset-4"
        >
          Tentar novamente
        </button>
      </div>
    );
  }
  return <Indicador cor="bg-emerald-600" texto={`API conectada · versão ${consulta.data.versao}`} />;
}

function Indicador({ cor, texto }: { cor: string; texto: string }) {
  return (
    <p className="flex items-center gap-2 text-sm" role="status">
      <span aria-hidden className={`size-2 rounded-full ${cor}`} />
      {texto}
    </p>
  );
}

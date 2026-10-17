'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CabecalhoPagina, ConteudoPagina } from '@/components/comum/pagina';
import { MontagemRota } from '@/components/rotas/montagem-rota';
import { buttonVariants } from '@/components/ui/button';
import { useCriarRota } from '@/lib/consultas/rotas';

export default function PaginaNovaRota() {
  const router = useRouter();
  const criar = useCriarRota();
  return (
    <ConteudoPagina>
      <CabecalhoPagina
        titulo="Criar rota"
        descricao="Escolha as empresas, a ordem da visita e o que fazer em cada parada."
        acoes={
          <Link href="/rotas" className={buttonVariants({ variant: 'ghost' })}>
            Voltar
          </Link>
        }
      />
      <MontagemRota
        rotuloSalvar="Salvar rascunho"
        onSalvar={async (dados) => {
          const rota = await criar.mutateAsync(dados);
          toast.success('Rota criada como rascunho.');
          router.push(`/rotas/${rota.id}`);
        }}
      />
    </ConteudoPagina>
  );
}

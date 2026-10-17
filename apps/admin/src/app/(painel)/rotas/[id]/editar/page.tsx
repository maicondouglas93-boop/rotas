'use client';

import { acoesAdminRota } from '@rotas/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CabecalhoPagina, ConteudoPagina, ErroCarregamento, LinhasCarregando, Vazio } from '@/components/comum/pagina';
import { StatusBadge } from '@/components/comum/status-badge';
import { MontagemRota } from '@/components/rotas/montagem-rota';
import { buttonVariants } from '@/components/ui/button';
import { useEditarRota, useRota } from '@/lib/consultas/rotas';

export default function PaginaEditarRota() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const consulta = useRota(id);
  const editar = useEditarRota(id);

  if (consulta.isPending) {
    return (
      <ConteudoPagina>
        <LinhasCarregando linhas={6} />
      </ConteudoPagina>
    );
  }
  if (consulta.isError) {
    return (
      <ConteudoPagina>
        <ErroCarregamento erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
      </ConteudoPagina>
    );
  }

  const rota = consulta.data;
  const voltar = (
    <Link href={`/rotas/${rota.id}`} className={buttonVariants({ variant: 'ghost' })}>
      Voltar para a rota
    </Link>
  );

  if (!acoesAdminRota(rota.status).editar) {
    return (
      <ConteudoPagina>
        <CabecalhoPagina titulo={rota.nome} acoes={voltar} />
        <Vazio titulo="Esta rota não pode mais ser alterada." descricao="Rotas concluídas ou canceladas ficam só para consulta." />
      </ConteudoPagina>
    );
  }

  return (
    <ConteudoPagina>
      <CabecalhoPagina
        titulo={
          <span className="flex items-center gap-2">
            Editar rota <StatusBadge tipo="rota" status={rota.status} />
          </span>
        }
        acoes={voltar}
      />
      <MontagemRota
        // Recria o formulário quando outra versão é carregada (conflito resolvido).
        key={rota.versao}
        rota={rota}
        rotuloSalvar="Salvar alterações"
        onRecarregar={() => consulta.refetch()}
        onSalvar={async (dados) => {
          await editar.mutateAsync({ ...dados, versao: rota.versao });
          toast.success('Rota atualizada.');
          router.push(`/rotas/${rota.id}`);
        }}
      />
    </ConteudoPagina>
  );
}

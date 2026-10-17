'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FormularioEmpresaCampos } from '@/components/empresas/formulario-empresa';
import { CabecalhoPagina, ConteudoPagina } from '@/components/comum/pagina';
import { buttonVariants } from '@/components/ui/button';
import { useCriarEmpresa } from '@/lib/consultas/empresas';

export default function PaginaNovaEmpresa() {
  const router = useRouter();
  const criar = useCriarEmpresa();

  return (
    <ConteudoPagina estreita>
      <CabecalhoPagina
        titulo="Cadastrar empresa"
        acoes={
          <Link href="/empresas" className={buttonVariants({ variant: 'ghost' })}>
            Voltar
          </Link>
        }
      />
      <FormularioEmpresaCampos
        rotuloEnviar="Salvar empresa"
        onEnviar={async (corpo) => {
          const empresa = await criar.mutateAsync(corpo);
          toast.success(`${empresa.nomeFantasia} cadastrada.`);
          router.push(`/empresas/${empresa.id}`);
        }}
      />
    </ConteudoPagina>
  );
}

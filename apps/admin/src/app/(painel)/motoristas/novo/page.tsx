'use client';

import type { MotoristaCriado } from '@rotas/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CabecalhoPagina, ConteudoPagina } from '@/components/comum/pagina';
import { FormularioMotorista } from '@/components/motoristas/formulario-motorista';
import { SenhaTemporariaDialog } from '@/components/motoristas/senha-temporaria-dialog';
import { buttonVariants } from '@/components/ui/button';
import { useCriarMotorista } from '@/lib/consultas/motoristas';

export default function PaginaNovoMotorista() {
  const router = useRouter();
  const criar = useCriarMotorista();
  const [criado, setCriado] = useState<MotoristaCriado | null>(null);

  return (
    <ConteudoPagina estreita>
      <CabecalhoPagina
        titulo="Cadastrar motorista"
        descricao="A senha temporária é gerada pelo sistema e mostrada uma única vez."
        acoes={
          <Link href="/motoristas" className={buttonVariants({ variant: 'ghost' })}>
            Voltar
          </Link>
        }
      />
      <FormularioMotorista
        rotuloEnviar="Cadastrar e gerar senha"
        onEnviar={async (dados) => setCriado(await criar.mutateAsync(dados))}
      />
      <SenhaTemporariaDialog
        senha={criado?.senhaTemporaria ?? null}
        nome={criado?.motorista.nome ?? ''}
        onFechar={() => criado && router.push(`/motoristas/${criado.motorista.id}`)}
      />
    </ConteudoPagina>
  );
}

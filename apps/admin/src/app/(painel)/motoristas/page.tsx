'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { CampoBusca } from '@/components/comum/campo-busca';
import {
  CabecalhoPagina,
  ConteudoPagina,
  ErroCarregamento,
  LinhasCarregando,
  Paginacao,
  Vazio,
} from '@/components/comum/pagina';
import { SituacaoMotorista } from '@/components/motoristas/situacao-motorista';
import { buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMotoristas } from '@/lib/consultas/motoristas';
import { useFiltrosUrl } from '@/lib/filtros-url';
import { formatarTelefone } from '@/lib/formatos';

function ListaMotoristas() {
  const router = useRouter();
  const { ler, definir, pagina } = useFiltrosUrl();
  const busca = ler('busca') ?? '';
  const incluirDesativados = ler('desativados') === 'true';
  const consulta = useMotoristas({ busca, incluirDesativados, pagina });

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CampoBusca valor={busca} onBuscar={(texto) => definir({ busca: texto })} placeholder="Nome ou e-mail" rotulo="Buscar motoristas" />
        <Label className="flex items-center gap-2 text-sm font-normal">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={incluirDesativados}
            onChange={(e) => definir({ desativados: e.target.checked })}
          />
          Mostrar desativados
        </Label>
      </div>

      {consulta.isPending ? (
        <LinhasCarregando />
      ) : consulta.isError ? (
        <ErroCarregamento erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
      ) : consulta.data.itens.length === 0 ? (
        busca ? (
          <Vazio titulo={`Nenhum motorista encontrado para “${busca}”.`} />
        ) : (
          <Vazio
            titulo="Nenhum motorista cadastrado."
            descricao="Cadastre os motoristas para atribuir rotas a eles."
            acao={
              <Link href="/motoristas/novo" className={buttonVariants()}>
                Cadastrar motorista
              </Link>
            }
          />
        )
      ) : (
        <>
          <div className="hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consulta.data.itens.map((m) => (
                  <TableRow key={m.id} className="h-11 cursor-pointer" onClick={() => router.push(`/motoristas/${m.id}`)}>
                    <TableCell className="font-medium">
                      <Link href={`/motoristas/${m.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                        {m.nome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell className="tabular-nums">{formatarTelefone(m.telefone)}</TableCell>
                    <TableCell>
                      <SituacaoMotorista motorista={m} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {consulta.data.itens.map((m) => (
              <li key={m.id}>
                <Link href={`/motoristas/${m.id}`} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{m.nome}</span>
                    <span className="truncate text-sm text-muted-foreground">{formatarTelefone(m.telefone)}</span>
                  </span>
                  <SituacaoMotorista motorista={m} />
                </Link>
              </li>
            ))}
          </ul>
          <Paginacao
            pagina={consulta.data.pagina}
            porPagina={consulta.data.porPagina}
            total={consulta.data.total}
            onMudar={(p) => definir({ pagina: p })}
          />
        </>
      )}
    </>
  );
}

export default function PaginaMotoristas() {
  return (
    <ConteudoPagina>
      <CabecalhoPagina
        titulo="Motoristas"
        descricao="Contas de acesso ao aplicativo do motorista."
        acoes={
          <Link href="/motoristas/novo" className={buttonVariants()}>
            Cadastrar motorista
          </Link>
        }
      />
      <Suspense fallback={<LinhasCarregando />}>
        <ListaMotoristas />
      </Suspense>
    </ConteudoPagina>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { CampoBusca } from '@/components/comum/campo-busca';
import { LinksExternos } from '@/components/comum/links-externos';
import {
  CabecalhoPagina,
  ConteudoPagina,
  ErroCarregamento,
  LinhasCarregando,
  Paginacao,
  Vazio,
} from '@/components/comum/pagina';
import { buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEmpresas } from '@/lib/consultas/empresas';
import { useFiltrosUrl } from '@/lib/filtros-url';
import { formatarTelefone } from '@/lib/formatos';

function ListaEmpresas() {
  const router = useRouter();
  const { ler, definir, pagina } = useFiltrosUrl();
  const busca = ler('busca') ?? '';
  const incluirArquivadas = ler('arquivadas') === 'true';
  const consulta = useEmpresas({ busca, incluirArquivadas, pagina });

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CampoBusca
          valor={busca}
          onBuscar={(texto) => definir({ busca: texto })}
          placeholder="Nome, bairro ou cidade"
          rotulo="Buscar empresas"
        />
        <Label className="flex items-center gap-2 text-sm font-normal">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={incluirArquivadas}
            onChange={(e) => definir({ arquivadas: e.target.checked })}
          />
          Mostrar arquivadas
        </Label>
      </div>

      {consulta.isPending ? (
        <LinhasCarregando />
      ) : consulta.isError ? (
        <ErroCarregamento erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
      ) : consulta.data.itens.length === 0 ? (
        busca ? (
          <Vazio titulo={`Nenhuma empresa encontrada para “${busca}”.`} descricao="Confira a grafia ou busque pelo bairro." />
        ) : (
          <Vazio
            titulo="Nenhuma empresa cadastrada."
            descricao="Cadastre as empresas atendidas para montar as rotas."
            acao={
              <Link href="/empresas/nova" className={buttonVariants()}>
                Cadastrar empresa
              </Link>
            }
          />
        )
      ) : (
        <>
          {/* Tabela no desktop, cartões no celular */}
          <div className="superficie hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Bairro / cidade</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">Contato e navegação</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consulta.data.itens.map((empresa) => (
                  <TableRow
                    key={empresa.id}
                    className="h-11 cursor-pointer"
                    onClick={() => router.push(`/empresas/${empresa.id}`)}
                  >
                    <TableCell className="font-medium">
                      <Link href={`/empresas/${empresa.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                        {empresa.nomeFantasia}
                      </Link>
                      {empresa.arquivadaEm ? <span className="ml-2 text-xs text-muted-foreground">(arquivada)</span> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {empresa.bairro} · {empresa.cidade}/{empresa.uf}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatarTelefone(empresa.telefone)}</TableCell>
                    <TableCell className="text-muted-foreground">{empresa.responsavel ?? '—'}</TableCell>
                    <TableCell>
                      <LinksExternos whatsapp={empresa.whatsapp} destino={empresa} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {consulta.data.itens.map((empresa) => (
              <li key={empresa.id} className="superficie flex items-center justify-between gap-2 p-3">
                <Link href={`/empresas/${empresa.id}`} className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{empresa.nomeFantasia}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {empresa.bairro} · {formatarTelefone(empresa.telefone)}
                  </span>
                </Link>
                <LinksExternos whatsapp={empresa.whatsapp} destino={empresa} />
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

export default function PaginaEmpresas() {
  return (
    <ConteudoPagina>
      <CabecalhoPagina
        titulo="Empresas"
        descricao="Clientes atendidos nas coletas e entregas."
        acoes={
          <Link href="/empresas/nova" className={buttonVariants()}>
            Cadastrar empresa
          </Link>
        }
      />
      <Suspense fallback={<LinhasCarregando />}>
        <ListaEmpresas />
      </Suspense>
    </ConteudoPagina>
  );
}

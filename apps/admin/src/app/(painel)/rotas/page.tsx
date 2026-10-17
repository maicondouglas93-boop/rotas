'use client';

import { ROTULO_STATUS_ROTA, StatusRota, type StatusRota as TipoStatusRota } from '@rotas/shared';
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
import { StatusBadge } from '@/components/comum/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRotas } from '@/lib/consultas/rotas';
import { useFiltrosUrl } from '@/lib/filtros-url';
import { formatarData, formatarDataHora, hoje } from '@/lib/formatos';

const ABERTAS = 'abertas';
const STATUS_ABERTOS: TipoStatusRota[] = ['RASCUNHO', 'ENVIADA', 'RECEBIDA', 'EM_ANDAMENTO'];

function ListaRotas() {
  const router = useRouter();
  const { ler, definir, pagina } = useFiltrosUrl();
  const busca = ler('busca') ?? '';
  const data = ler('data') ?? '';
  const situacao = ler('situacao') ?? ABERTAS;
  const status: TipoStatusRota[] | undefined =
    situacao === ABERTAS ? STATUS_ABERTOS : situacao === 'todas' ? undefined : [situacao as TipoStatusRota];
  const consulta = useRotas({ busca, status, data: data || undefined, pagina });

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <CampoBusca valor={busca} onBuscar={(texto) => definir({ busca: texto })} placeholder="Nome da rota" rotulo="Buscar rotas" />
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Situação"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            value={situacao}
            onChange={(e) => definir({ situacao: e.target.value === ABERTAS ? undefined : e.target.value })}
          >
            <option value={ABERTAS}>Em aberto</option>
            <option value="todas">Todas</option>
            {Object.values(StatusRota).map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS_ROTA[s]}
              </option>
            ))}
          </select>
          <Input
            type="date"
            aria-label="Data da rota"
            className="h-8 w-auto"
            value={data}
            onChange={(e) => definir({ data: e.target.value })}
          />
          <Button variant={data === hoje() ? 'secondary' : 'outline'} size="sm" onClick={() => definir({ data: data === hoje() ? undefined : hoje() })}>
            Hoje
          </Button>
        </div>
      </div>

      {consulta.isPending ? (
        <LinhasCarregando />
      ) : consulta.isError ? (
        <ErroCarregamento erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
      ) : consulta.data.itens.length === 0 ? (
        <Vazio
          titulo={busca || data ? 'Nenhuma rota com estes filtros.' : 'Nenhuma rota em aberto.'}
          descricao={busca || data ? 'Ajuste a busca, a data ou a situação.' : 'Monte uma rota com as empresas cadastradas.'}
          acao={
            busca || data ? undefined : (
              <Link href="/rotas/nova" className={buttonVariants()}>
                Criar rota
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="superficie hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Data</TableHead>
                  <TableHead>Rota</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead className="text-right">Paradas</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Atualizada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consulta.data.itens.map((r) => (
                  <TableRow key={r.id} className="h-11 cursor-pointer" onClick={() => router.push(`/rotas/${r.id}`)}>
                    <TableCell className="tabular-nums">{formatarData(r.dataPrevista)}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/rotas/${r.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                        {r.nome}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {r.motorista ? (
                        <span className={r.motorista.ativo ? undefined : 'text-destructive'}>
                          {r.motorista.nome}
                          {r.motorista.ativo ? null : ' (desativado)'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sem motorista</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.paradasConcluidas}/{r.totalParadas}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tipo="rota" status={r.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{formatarDataHora(r.atualizadoEm)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {consulta.data.itens.map((r) => (
              <li key={r.id}>
                <Link href={`/rotas/${r.id}`} className="superficie flex flex-col gap-1 p-3">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{r.nome}</span>
                    <StatusBadge tipo="rota" status={r.status} />
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatarData(r.dataPrevista)} · {r.motorista?.nome ?? 'Sem motorista'} · {r.paradasConcluidas}/{r.totalParadas} paradas
                  </span>
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

export default function PaginaRotas() {
  return (
    <ConteudoPagina>
      <CabecalhoPagina
        titulo="Rotas"
        descricao="Montagem, envio e acompanhamento das rotas."
        acoes={
          <Link href="/rotas/nova" className={buttonVariants()}>
            Criar rota
          </Link>
        }
      />
      <Suspense fallback={<LinhasCarregando />}>
        <ListaRotas />
      </Suspense>
    </ConteudoPagina>
  );
}

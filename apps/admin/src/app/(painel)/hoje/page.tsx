'use client';

import {
  ROTULO_TIPO_OCORRENCIA,
  ROTULO_TIPO_SERVICO,
  type OcorrenciaDoDia,
  type RotaDoDia,
  type StatusRota,
} from '@rotas/shared';
import { ClockIcon, MapPinIcon, NavigationIcon, PlusIcon, TriangleAlertIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import { BarraProgresso } from '@/components/comum/barra-progresso';
import { CabecalhoPagina, ConteudoPagina, ErroCarregamento, LinhasCarregando, Vazio } from '@/components/comum/pagina';
import { StatusBadge } from '@/components/comum/status-badge';
import { buttonVariants } from '@/components/ui/button';
import { usePainelHoje } from '@/lib/consultas/painel';
import { useEstadoTempoReal } from '@/lib/estado-tempo-real';
import { formatarDataPorExtenso, formatarHaQuanto, formatarHora } from '@/lib/formatos';
import { pendenciasDoDia } from '@/lib/pendencias';
import { useAgora } from '@/lib/use-agora';

/** "2 em andamento · 1 aguardando o motorista · 1 rascunho · 3 concluídas" (só o que existe). */
function resumoDoDia(rotas: RotaDoDia[]): string {
  const contar = (...status: StatusRota[]) => rotas.filter((r) => status.includes(r.status)).length;
  const partes: [number, string, string][] = [
    [contar('EM_ANDAMENTO'), 'em andamento', 'em andamento'],
    [contar('ENVIADA', 'RECEBIDA'), 'aguardando o motorista', 'aguardando o motorista'],
    [contar('RASCUNHO'), 'rascunho', 'rascunhos'],
    [contar('CONCLUIDA'), 'concluída', 'concluídas'],
    [contar('CANCELADA'), 'cancelada', 'canceladas'],
  ];
  return partes
    .filter(([n]) => n > 0)
    .map(([n, um, varios]) => `${n} ${n === 1 ? um : varios}`)
    .join(' · ');
}

function CartaoRotaDoDia({ rota, agora }: { rota: RotaDoDia; agora: number }) {
  return (
    <li>
      <Link
        href={`/rotas/${rota.id}`}
        className="superficie flex flex-col gap-3 p-4 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-semibold">{rota.nome}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserIcon aria-hidden className="size-3.5" />
              {rota.motorista?.nome ?? 'Sem motorista'}
            </span>
          </div>
          <StatusBadge tipo="rota" status={rota.status} />
        </div>

        <div className="flex items-center gap-3">
          <BarraProgresso feitas={rota.paradasConcluidas} total={rota.totalParadas} className="flex-1" />
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {rota.paradasConcluidas}/{rota.totalParadas} paradas
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {rota.paradaAtual ? (
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              {rota.paradaAtual.status === 'NO_LOCAL' ? (
                <MapPinIcon aria-hidden className="size-3.5 text-alerta" />
              ) : (
                <NavigationIcon aria-hidden className="size-3.5 text-info" />
              )}
              {rota.paradaAtual.status === 'NO_LOCAL' ? 'No local: ' : 'A caminho de '}
              {rota.paradaAtual.nomeEmpresa}
            </span>
          ) : null}
          {rota.ocorrencias > 0 ? (
            <span className="flex items-center gap-1.5 font-medium text-alerta">
              <TriangleAlertIcon aria-hidden className="size-3.5" />
              {rota.ocorrencias === 1 ? '1 ocorrência' : `${rota.ocorrencias} ocorrências`}
            </span>
          ) : null}
          {rota.ultimaAtividadeEm ? (
            <span className="flex items-center gap-1.5">
              <ClockIcon aria-hidden className="size-3.5" />
              Atualizada {formatarHaQuanto(rota.ultimaAtividadeEm, agora)}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function ItemOcorrencia({ ocorrencia }: { ocorrencia: OcorrenciaDoDia }) {
  return (
    <li>
      <Link href={`/rotas/${ocorrencia.rotaId}`} className="flex gap-2.5 rounded-md p-2 hover:bg-muted/60">
        <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-alerta" />
        <span className="flex min-w-0 flex-col gap-0.5 text-sm">
          <span>
            <span className="font-medium">{ROTULO_TIPO_OCORRENCIA[ocorrencia.tipo]}</span>
            {ocorrencia.servicoTipo ? (
              <span className="text-muted-foreground"> · {ROTULO_TIPO_SERVICO[ocorrencia.servicoTipo]} não realizada</span>
            ) : null}
          </span>
          {ocorrencia.descricao ? <span className="break-words">“{ocorrencia.descricao}”</span> : null}
          <span className="text-xs text-muted-foreground">
            {formatarHora(ocorrencia.ocorridaEm)} · {ocorrencia.nomeEmpresa} · {ocorrencia.rotaNome} · {ocorrencia.motoristaNome}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function PaginaHoje() {
  const consulta = usePainelHoje();
  const conexao = useEstadoTempoReal();
  const agora = useAgora();

  const criarRota = (
    <Link href="/rotas/nova" className={buttonVariants()}>
      <PlusIcon aria-hidden />
      Criar rota
    </Link>
  );

  if (consulta.isPending) {
    return (
      <ConteudoPagina>
        <CabecalhoPagina titulo="Hoje" acoes={criarRota} />
        <LinhasCarregando linhas={4} />
      </ConteudoPagina>
    );
  }
  if (consulta.isError) {
    return (
      <ConteudoPagina>
        <CabecalhoPagina titulo="Hoje" acoes={criarRota} />
        <ErroCarregamento erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
      </ConteudoPagina>
    );
  }

  const { data, rotas, ocorrencias } = consulta.data;
  const pendencias = pendenciasDoDia(rotas, agora);
  const resumo = resumoDoDia(rotas);

  return (
    <ConteudoPagina>
      <CabecalhoPagina
        titulo="Hoje"
        descricao={resumo ? `${formatarDataPorExtenso(data)} · ${resumo}` : formatarDataPorExtenso(data)}
        acoes={criarRota}
      />

      {rotas.length === 0 ? (
        <Vazio
          titulo="Nenhuma rota para hoje."
          descricao="Monte uma rota com as empresas cadastradas e envie ao motorista."
          acao={criarRota}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <section className="flex flex-col gap-3" aria-labelledby="titulo-rotas-hoje">
            <div className="flex items-center justify-between gap-2">
              <h2 id="titulo-rotas-hoje" className="text-base font-semibold">
                Rotas de hoje
              </h2>
              {conexao === 'ao-vivo' ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden className="size-2 animate-pulse rounded-full bg-emerald-500" />
                  Ao vivo
                </span>
              ) : null}
            </div>
            <ul className="flex flex-col gap-3">
              {rotas.map((rota) => (
                <CartaoRotaDoDia key={rota.id} rota={rota} agora={agora} />
              ))}
            </ul>
          </section>

          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3" aria-labelledby="titulo-atencao">
              <h2 id="titulo-atencao" className="text-base font-semibold">
                Precisa de atenção
              </h2>
              <div className="superficie p-2">
                {pendencias.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">Nada pendente agora.</p>
                ) : (
                  <ul className="flex flex-col">
                    {pendencias.map(({ rota, motivo }) => (
                      <li key={rota.id}>
                        <Link href={`/rotas/${rota.id}`} className="flex flex-col gap-0.5 rounded-md p-2 hover:bg-muted/60">
                          <span className="text-sm font-medium">{rota.nome}</span>
                          <span className="text-xs text-muted-foreground">{motivo}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-3" aria-labelledby="titulo-ocorrencias">
              <h2 id="titulo-ocorrencias" className="text-base font-semibold">
                Ocorrências de hoje
              </h2>
              <div className="superficie p-2">
                {ocorrencias.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">Nenhuma ocorrência registrada hoje.</p>
                ) : (
                  <ul className="flex flex-col">
                    {ocorrencias.map((o) => (
                      <ItemOcorrencia key={o.id} ocorrencia={o} />
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </ConteudoPagina>
  );
}

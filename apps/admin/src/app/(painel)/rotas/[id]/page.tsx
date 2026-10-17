'use client';

import {
  acoesAdminRota,
  ROTULO_EVENTO_ROTA,
  ROTULO_TIPO_OCORRENCIA,
  ROTULO_TIPO_SERVICO,
  tipoOcorrenciaSchema,
  tipoServicoSchema,
  type EventoRota,
  type OcorrenciaRota,
  type Parada,
  type Rota,
} from '@rotas/shared';
import { CheckIcon, MoreHorizontalIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { LinksExternos } from '@/components/comum/links-externos';
import { CabecalhoPagina, ConteudoPagina, ErroCarregamento, LinhasCarregando } from '@/components/comum/pagina';
import { StatusBadge } from '@/components/comum/status-badge';
import {
  DialogoConfirmar,
  DialogoDuplicar,
  DialogoMotivo,
  DialogoTransferir,
} from '@/components/rotas/dialogos-rota';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useCancelarParada,
  useCancelarRota,
  useDuplicarRota,
  useEnviarRota,
  useExcluirRota,
  rotaEmExecucao,
  useHistoricoRota,
  useOcorrenciasRota,
  useRota,
  useTransferirRota,
} from '@/lib/consultas/rotas';
import { useEstadoTempoReal } from '@/lib/estado-tempo-real';
import { formatarData, formatarDataHora, formatarHora } from '@/lib/formatos';
import { cn } from '@/lib/utils';

type Dialogo = 'enviar' | 'cancelar' | 'transferir' | 'duplicar' | 'excluir' | null;

function Informacao({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm font-medium tabular-nums">{children}</dd>
    </div>
  );
}

/** O que o motorista relatou na parada: motivo, serviço afetado, descrição, hora e autor. */
function OcorrenciasParada({ parada, ocorrencias }: { parada: Parada; ocorrencias: OcorrenciaRota[] }) {
  if (ocorrencias.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2 rounded-md border border-alerta/25 bg-alerta-fundo p-2.5 text-sm">
      {ocorrencias.map((o) => {
        const servico = o.servicoId ? parada.servicos.find((s) => s.id === o.servicoId) : undefined;
        return (
          <li key={o.id} className="flex items-start gap-2">
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-alerta" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span>
                <span className="font-medium">{ROTULO_TIPO_OCORRENCIA[o.tipo]}</span>
                {servico ? (
                  <span className="text-muted-foreground"> · {ROTULO_TIPO_SERVICO[servico.tipo]} não realizada</span>
                ) : null}
              </span>
              {o.descricao ? <span className="break-words">“{o.descricao}”</span> : null}
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatarHora(o.ocorridaEm)} · {o.motorista.nome}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Bolinha da linha do tempo: número da parada, ✓ quando finalizada, × quando cancelada (igual ao app). */
function Marcador({ parada, atual }: { parada: Parada; atual: boolean }) {
  const base = 'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums';
  if (parada.status === 'FINALIZADA') {
    return (
      <span className={cn(base, 'border-sucesso bg-sucesso text-white dark:text-background')}>
        <CheckIcon className="size-4" aria-label="Finalizada" />
      </span>
    );
  }
  if (parada.status === 'CANCELADA') {
    return (
      <span className={cn(base, 'border-border bg-muted text-muted-foreground')}>
        <XIcon className="size-4" aria-label="Cancelada" />
      </span>
    );
  }
  return (
    <span className={cn(base, atual ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-muted-foreground')}>
      {parada.sequencia}
    </span>
  );
}

function LinhaParada({
  parada,
  ocorrencias,
  atual,
  ultima,
  podeCancelar,
  onCancelar,
}: {
  parada: Parada;
  ocorrencias: OcorrenciaRota[];
  atual: boolean;
  ultima: boolean;
  podeCancelar: boolean;
  onCancelar: () => void;
}) {
  const cancelavel = podeCancelar && (parada.status === 'PENDENTE' || parada.status === 'A_CAMINHO');
  const encerrada = parada.status === 'FINALIZADA' || parada.status === 'CANCELADA';
  return (
    <li className={cn('relative flex gap-3', !ultima && 'pb-3')}>
      {!ultima ? (
        <span
          aria-hidden
          className={cn('absolute top-10 bottom-0 left-[15px] w-0.5 rounded-full', encerrada ? 'bg-sucesso' : 'bg-border')}
        />
      ) : null}
      <div className="pt-3">
        <Marcador parada={parada} atual={atual} />
      </div>
      <div
        className={cn(
          'superficie flex min-w-0 flex-1 gap-3 p-4',
          atual && 'border-primary ring-1 ring-primary',
          encerrada && 'bg-muted/40',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {atual ? <span className="text-[11px] font-bold tracking-widest text-primary uppercase">Próxima</span> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="truncate font-semibold">{parada.nomeEmpresa}</span>
            <StatusBadge tipo="parada" status={parada.status} />
          </div>
          <span className="text-xs text-muted-foreground">{parada.enderecoFormatado}</span>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {parada.servicos.map((s) => (
              <span key={s.id} className="flex items-center gap-1">
                {ROTULO_TIPO_SERVICO[s.tipo]}: <StatusBadge tipo="servico" status={s.status} />
                {s.concluidoEm ? <span className="text-xs text-muted-foreground">às {formatarHora(s.concluidoEm)}</span> : null}
              </span>
            ))}
          </div>
          {parada.observacoes ? (
            <p className="rounded-md bg-alerta-fundo px-2.5 py-1.5 text-sm font-medium text-alerta">
              Obs.: {parada.observacoes}
            </p>
          ) : null}
          {parada.chegadaEm ? (
            <span className="text-xs text-muted-foreground">Chegada às {formatarHora(parada.chegadaEm)}</span>
          ) : null}
          <OcorrenciasParada parada={parada} ocorrencias={ocorrencias} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <LinksExternos whatsapp={parada.whatsapp} destino={parada} />
          {cancelavel ? (
            <Button variant="ghost" size="sm" onClick={onCancelar}>
              Cancelar parada
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

const UM_MINUTO_MS = 60_000;

/** Complemento legível do evento: motivo da ocorrência ou serviço, empresa da parada e motivo do admin. */
function detalheEvento(evento: EventoRota, nomesParadas: Map<string, string>): string | null {
  const { dados } = evento;
  const partes: string[] = [];
  if (evento.tipo === 'OCORRENCIA_REGISTRADA') {
    const tipo = tipoOcorrenciaSchema.safeParse(dados.tipo);
    if (tipo.success) partes.push(ROTULO_TIPO_OCORRENCIA[tipo.data]);
  } else if (evento.tipo === 'SERVICO_REALIZADO' || evento.tipo === 'SERVICO_NAO_REALIZADO') {
    const tipo = tipoServicoSchema.safeParse(dados.tipo);
    if (tipo.success) partes.push(ROTULO_TIPO_SERVICO[tipo.data]);
  }
  const nome = typeof dados.paradaId === 'string' ? nomesParadas.get(dados.paradaId) : undefined;
  if (nome) partes.push(nome);
  if (typeof dados.motivo === 'string') partes.push(dados.motivo);
  return partes.length > 0 ? partes.join(' · ') : null;
}

function Historico({ rota }: { rota: Rota }) {
  const consulta = useHistoricoRota(rota.id, rotaEmExecucao(rota.status));
  if (consulta.isPending) return <LinhasCarregando linhas={3} />;
  if (consulta.isError) return <ErroCarregamento erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />;
  const nomesParadas = new Map(rota.paradas.map((p) => [p.id, p.nomeEmpresa]));
  return (
    <ol className="flex flex-col gap-2.5 border-l pl-4">
      {[...consulta.data].reverse().map((evento) => {
        const detalhe = detalheEvento(evento, nomesParadas);
        // Ação feita sem sinal: mostra a hora do toque e quando chegou ao servidor.
        const sincronizadoDepois =
          evento.ocorridoEm !== null &&
          new Date(evento.criadoEm).getTime() - new Date(evento.ocorridoEm).getTime() > UM_MINUTO_MS;
        return (
          <li key={evento.id} className="flex flex-col">
            <span className="text-sm">
              {ROTULO_EVENTO_ROTA[evento.tipo]}
              {evento.autorUsuarioId === null ? <span className="text-muted-foreground"> (automático)</span> : null}
            </span>
            {detalhe ? <span className="text-xs text-foreground/80">{detalhe}</span> : null}
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatarDataHora(evento.ocorridoEm ?? evento.criadoEm)}
              {sincronizadoDepois ? ` · enviado às ${formatarHora(evento.criadoEm)}` : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ConteudoRota({ rota }: { rota: Rota }) {
  const router = useRouter();
  const acoes = acoesAdminRota(rota.status);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [paradaACancelar, setParadaACancelar] = useState<Parada | null>(null);
  const enviar = useEnviarRota();
  const cancelar = useCancelarRota();
  const transferir = useTransferirRota();
  const duplicar = useDuplicarRota();
  const excluir = useExcluirRota();
  const cancelarParada = useCancelarParada();
  const fechar = () => setDialogo(null);
  const concluidas = rota.paradas.filter((p) => p.status === 'FINALIZADA' || p.status === 'CANCELADA').length;
  const percentual = rota.paradas.length > 0 ? Math.round((concluidas / rota.paradas.length) * 100) : 0;
  const emExecucao = rotaEmExecucao(rota.status);
  const conexao = useEstadoTempoReal();
  // Mesma regra do app: parada em curso, senão a primeira pendente.
  const proxima =
    rota.status === 'EM_ANDAMENTO'
      ? (rota.paradas.find((p) => p.status === 'NO_LOCAL' || p.status === 'A_CAMINHO') ??
        rota.paradas.find((p) => p.status === 'PENDENTE'))
      : undefined;
  const ocorrencias = useOcorrenciasRota(rota.id, emExecucao);
  const ocorrenciasPorParada = Map.groupBy(ocorrencias.data ?? [], (o) => o.paradaId);

  return (
    <ConteudoPagina>
      <CabecalhoPagina
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            {rota.nome} <StatusBadge tipo="rota" status={rota.status} />
          </span>
        }
        descricao={`${formatarData(rota.dataPrevista)} · ${concluidas}/${rota.paradas.length} paradas concluídas`}
        acoes={
          <>
            {acoes.enviar ? <Button onClick={() => setDialogo('enviar')}>Enviar ao motorista</Button> : null}
            {acoes.editar ? (
              <Link href={`/rotas/${rota.id}/editar`} className={buttonVariants({ variant: acoes.enviar ? 'outline' : 'default' })}>
                Editar
              </Link>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Mais ações" />}>
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {acoes.transferir ? <DropdownMenuItem onClick={() => setDialogo('transferir')}>Transferir para outro motorista</DropdownMenuItem> : null}
                <DropdownMenuItem onClick={() => setDialogo('duplicar')}>Duplicar rota</DropdownMenuItem>
                {acoes.cancelar ? (
                  <DropdownMenuItem variant="destructive" onClick={() => setDialogo('cancelar')}>
                    Cancelar rota
                  </DropdownMenuItem>
                ) : null}
                {acoes.excluir ? (
                  <DropdownMenuItem variant="destructive" onClick={() => setDialogo('excluir')}>
                    Excluir rascunho
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {rota.motorista && !rota.motorista.ativo && acoes.cancelar ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          O motorista {rota.motorista.nome} foi desativado. Transfira a rota para outro motorista ou cancele-a.
        </p>
      ) : null}

      <div className="superficie flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight tabular-nums">{concluidas}</span>
            <span className="text-sm font-medium text-muted-foreground">de {rota.paradas.length} paradas concluídas</span>
          </p>
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">{percentual}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Paradas concluídas"
          aria-valuemin={0}
          aria-valuemax={rota.paradas.length}
          aria-valuenow={concluidas}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn('h-full rounded-full transition-[width]', percentual === 100 ? 'bg-sucesso' : 'bg-primary')}
            style={{ width: `${percentual}%` }}
          />
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-5">
          <Informacao rotulo="Motorista">{rota.motorista?.nome ?? 'Definir antes de enviar'}</Informacao>
          <Informacao rotulo="Enviada">{formatarDataHora(rota.enviadaEm)}</Informacao>
          <Informacao rotulo="Recebida">{formatarDataHora(rota.recebidaEm)}</Informacao>
          <Informacao rotulo="Iniciada">{formatarDataHora(rota.iniciadaEm)}</Informacao>
          <Informacao rotulo={rota.status === 'CANCELADA' ? 'Cancelada' : 'Concluída'}>
            {formatarDataHora(rota.status === 'CANCELADA' ? rota.canceladaEm : rota.concluidaEm)}
          </Informacao>
        </dl>
      </div>
      {rota.motivoCancelamento ? <p className="text-sm text-muted-foreground">Motivo do cancelamento: {rota.motivoCancelamento}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="flex flex-col gap-3" aria-labelledby="titulo-paradas">
          <div className="flex items-center justify-between gap-2">
            <h2 id="titulo-paradas" className="text-base font-semibold">
              Paradas
            </h2>
            {emExecucao ? (
              conexao === 'ao-vivo' ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden className="size-2 animate-pulse rounded-full bg-emerald-500" />
                  Ao vivo
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden className="size-2 rounded-full bg-amber-500" />
                  Atualizando a cada 30 s
                </span>
              )
            ) : null}
          </div>
          {rota.paradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma parada. Edite a rota para adicionar empresas.</p>
          ) : (
            <ol className="flex flex-col">
              {rota.paradas.map((p, i) => (
                <LinhaParada
                  key={p.id}
                  parada={p}
                  ocorrencias={ocorrenciasPorParada.get(p.id) ?? []}
                  atual={p.id === proxima?.id}
                  ultima={i === rota.paradas.length - 1}
                  podeCancelar={acoes.cancelarParada}
                  onCancelar={() => setParadaACancelar(p)}
                />
              ))}
            </ol>
          )}
        </section>
        <section className="flex flex-col gap-3" aria-labelledby="titulo-historico">
          <h2 id="titulo-historico" className="text-base font-semibold">
            Histórico
          </h2>
          <div className="superficie p-4">
            <Historico rota={rota} />
          </div>
        </section>
      </div>

      <DialogoConfirmar
        aberto={dialogo === 'enviar'}
        onFechar={fechar}
        titulo={`Enviar “${rota.nome}”?`}
        descricao={`A rota aparece no app de ${rota.motorista?.nome ?? 'motorista'}, que confirma o recebimento antes de iniciar.`}
        rotuloConfirmar="Enviar ao motorista"
        onConfirmar={async () => {
          await enviar.mutateAsync({ id: rota.id, versao: rota.versao });
          toast.success('Rota enviada ao motorista.');
        }}
      />
      <DialogoMotivo
        aberto={dialogo === 'cancelar'}
        onFechar={fechar}
        titulo={`Cancelar “${rota.nome}”?`}
        descricao="Paradas ainda abertas são canceladas. O que já foi feito fica registrado."
        rotuloConfirmar="Cancelar rota"
        onConfirmar={async (motivo) => {
          await cancelar.mutateAsync({ id: rota.id, versao: rota.versao, motivo });
          toast.success('Rota cancelada.');
        }}
      />
      <DialogoTransferir
        aberto={dialogo === 'transferir'}
        onFechar={fechar}
        motoristaAtualId={rota.motorista?.id ?? null}
        onConfirmar={async (motoristaId, motivo) => {
          await transferir.mutateAsync({ id: rota.id, versao: rota.versao, motoristaId, motivo });
          toast.success('Rota transferida.');
        }}
      />
      <DialogoDuplicar
        aberto={dialogo === 'duplicar'}
        onFechar={fechar}
        dataSugerida={rota.dataPrevista}
        onConfirmar={async (dataPrevista) => {
          const { rota: copia, empresasOmitidas } = await duplicar.mutateAsync({ id: rota.id, dataPrevista });
          toast.success(
            empresasOmitidas.length > 0
              ? `Rota duplicada. ${empresasOmitidas.length} empresa(s) arquivada(s) ficaram de fora.`
              : 'Rota duplicada como rascunho.',
          );
          router.push(`/rotas/${copia.id}`);
        }}
      />
      <DialogoConfirmar
        aberto={dialogo === 'excluir'}
        onFechar={fechar}
        titulo={`Excluir o rascunho “${rota.nome}”?`}
        descricao="O rascunho é apagado de vez. Rotas já enviadas não são excluídas, só canceladas."
        rotuloConfirmar="Excluir rascunho"
        destrutivo
        onConfirmar={async () => {
          await excluir.mutateAsync({ id: rota.id, versao: rota.versao });
          toast.success('Rascunho excluído.');
          router.push('/rotas');
        }}
      />
      <DialogoMotivo
        aberto={paradaACancelar !== null}
        onFechar={() => setParadaACancelar(null)}
        titulo={`Cancelar a parada em ${paradaACancelar?.nomeEmpresa ?? ''}?`}
        descricao="Os serviços pendentes desta parada são cancelados. Se for a última parada aberta, a rota é concluída."
        rotuloConfirmar="Cancelar parada"
        onConfirmar={async (motivo) => {
          if (!paradaACancelar) return;
          await cancelarParada.mutateAsync({ id: rota.id, paradaId: paradaACancelar.id, versao: rota.versao, motivo });
          toast.success('Parada cancelada.');
        }}
      />
    </ConteudoPagina>
  );
}

export default function PaginaRota() {
  const { id } = useParams<{ id: string }>();
  const consulta = useRota(id);
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
  return <ConteudoRota rota={consulta.data} />;
}

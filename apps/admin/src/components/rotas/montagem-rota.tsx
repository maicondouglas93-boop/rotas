'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CodigoErro,
  ErroApi,
  ROTULO_TIPO_SERVICO,
  TipoServico,
  type Empresa,
  type Rota,
  type StatusParada,
  type StatusRota,
} from '@rotas/shared';
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/comum/status-badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useMotoristas } from '@/lib/consultas/motoristas';
import type { DadosMontagem } from '@/lib/consultas/rotas';
import { mensagemDeErro } from '@/lib/erros';
import { hoje } from '@/lib/formatos';
import { cn } from '@/lib/utils';
import { BuscaEmpresa } from './busca-empresa';

interface ItemParada {
  chave: string;
  id?: string;
  empresaId: string;
  nomeEmpresa: string;
  endereco: string;
  servicos: TipoServico[];
  observacoes: string;
  /** Status atual (paradas existentes); só PENDENTE é livre numa rota em andamento. */
  status?: StatusParada;
}

const TIPOS = [TipoServico.COLETA, TipoServico.ENTREGA] as const;
let contadorChaves = 0;
const novaChave = () => `nova-${++contadorChaves}`;

function itensDaRota(rota?: Rota): ItemParada[] {
  return (rota?.paradas ?? []).map((p) => ({
    chave: p.id,
    id: p.id,
    empresaId: p.empresaId,
    nomeEmpresa: p.nomeEmpresa,
    endereco: p.enderecoFormatado,
    servicos: p.servicos.map((s) => s.tipo),
    observacoes: p.observacoes ?? '',
    status: p.status,
  }));
}

/** Numa rota em andamento, paradas já iniciadas ou encerradas não mudam (delivery-domain-rules). */
function travada(item: ItemParada, status: StatusRota | undefined): boolean {
  return status === 'EM_ANDAMENTO' && item.status !== undefined && item.status !== 'PENDENTE';
}

function LinhaParada({
  item,
  indice,
  total,
  bloqueada,
  onMudar,
  onRemover,
  onMover,
}: {
  item: ItemParada;
  indice: number;
  total: number;
  bloqueada: boolean;
  onMudar: (mudanca: Partial<ItemParada>) => void;
  onRemover?: () => void;
  onMover: (destino: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.chave,
    disabled: bloqueada,
  });
  const estilo = { transform: CSS.Transform.toString(transform), transition };

  function alternarServico(tipo: TipoServico) {
    const tem = item.servicos.includes(tipo);
    if (tem && item.servicos.length === 1) return; // ao menos um serviço
    onMudar({ servicos: tem ? item.servicos.filter((t) => t !== tipo) : TIPOS.filter((t) => t === tipo || item.servicos.includes(t)) });
  }

  return (
    <li
      ref={setNodeRef}
      style={estilo}
      className={cn(
        'flex gap-2 rounded-lg border bg-background p-3',
        isDragging && 'relative z-10 shadow-md',
        bloqueada && 'bg-muted/40',
      )}
    >
      <div className="flex flex-col items-center gap-1 pt-0.5">
        {bloqueada ? (
          <span className="flex size-7 items-center justify-center" aria-hidden />
        ) : (
          <button
            type="button"
            className="flex size-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
            aria-label={`Arrastar parada ${indice + 1}`}
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-4" />
          </button>
        )}
        <span className="text-sm font-semibold tabular-nums">{indice + 1}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{item.nomeEmpresa}</span>
            <span className="truncate text-xs text-muted-foreground">{item.endereco}</span>
          </div>
          {item.status && item.status !== 'PENDENTE' ? <StatusBadge tipo="parada" status={item.status} /> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="group" aria-label={`Serviços da parada ${indice + 1}`}>
            {TIPOS.map((tipo) => {
              const ativo = item.servicos.includes(tipo);
              return (
                <Button
                  key={tipo}
                  type="button"
                  size="sm"
                  variant={ativo ? 'secondary' : 'outline'}
                  aria-pressed={ativo}
                  disabled={bloqueada}
                  className={cn(ativo && 'ring-1 ring-primary/40')}
                  onClick={() => alternarServico(tipo)}
                >
                  {ROTULO_TIPO_SERVICO[tipo]}
                </Button>
              );
            })}
          </div>
          <Input
            aria-label={`Observação da parada ${indice + 1}`}
            placeholder="Observação para o motorista (opcional)"
            value={item.observacoes}
            disabled={bloqueada && item.status !== 'A_CAMINHO' && item.status !== 'NO_LOCAL'}
            onChange={(e) => onMudar({ observacoes: e.target.value })}
            className="h-7 min-w-48 flex-1"
            maxLength={1000}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Mover parada ${indice + 1} para cima`}
          disabled={bloqueada || indice === 0}
          onClick={() => onMover(indice - 1)}
        >
          <ArrowUpIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Mover parada ${indice + 1} para baixo`}
          disabled={bloqueada || indice === total - 1}
          onClick={() => onMover(indice + 1)}
        >
          <ArrowDownIcon />
        </Button>
        {onRemover ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover parada ${indice + 1}`} onClick={onRemover}>
            <Trash2Icon />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function MontagemRota({
  rota,
  rotuloSalvar,
  onSalvar,
  onRecarregar,
}: {
  rota?: Rota;
  rotuloSalvar: string;
  onSalvar: (dados: DadosMontagem) => Promise<void>;
  onRecarregar?: () => void;
}) {
  const [nome, setNome] = useState(rota?.nome ?? '');
  const [dataPrevista, setDataPrevista] = useState(rota?.dataPrevista ?? hoje());
  const [motoristaId, setMotoristaId] = useState(rota?.motorista?.id ?? '');
  const [itens, setItens] = useState<ItemParada[]>(() => itensDaRota(rota));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; conflito: boolean } | null>(null);
  const motoristas = useMotoristas({ pagina: 1, porPagina: 100 });
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const status = rota?.status;
  const emAndamento = status === 'EM_ANDAMENTO';
  const podeTrocarMotorista = !rota || status === 'RASCUNHO';
  const naRota = useMemo(() => new Set(itens.map((i) => i.empresaId)), [itens]);

  const mudar = (chave: string, mudanca: Partial<ItemParada>) =>
    setItens((atuais) => atuais.map((i) => (i.chave === chave ? { ...i, ...mudanca } : i)));
  const mover = (de: number, para: number) => setItens((atuais) => arrayMove(atuais, de, para));

  function aoSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;
    const de = itens.findIndex((i) => i.chave === active.id);
    const para = itens.findIndex((i) => i.chave === over.id);
    if (de >= 0 && para >= 0) mover(de, para);
  }

  function adicionar(empresa: Empresa) {
    setItens((atuais) => [
      ...atuais,
      {
        chave: novaChave(),
        empresaId: empresa.id,
        nomeEmpresa: empresa.nomeFantasia,
        endereco: empresa.enderecoFormatado,
        servicos: [TipoServico.ENTREGA],
        observacoes: '',
      },
    ]);
  }

  async function salvar() {
    setErro(null);
    if (nome.trim().length < 2) {
      setErro({ mensagem: 'Informe o nome da rota.', conflito: false });
      return;
    }
    setSalvando(true);
    try {
      await onSalvar({
        nome: nome.trim(),
        dataPrevista,
        motoristaId: motoristaId || null,
        paradas: itens.map((i) => ({ id: i.id, empresaId: i.empresaId, servicos: i.servicos, observacoes: i.observacoes })),
      });
    } catch (e) {
      const conflito = e instanceof ErroApi && e.codigo === CodigoErro.CONFLITO_VERSAO;
      setErro({ mensagem: mensagemDeErro(e), conflito });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_minmax(14rem,auto)]">
        <Field>
          <FieldLabel htmlFor="nome-rota">Nome da rota</FieldLabel>
          <Input id="nome-rota" value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Centro — manhã" />
        </Field>
        <Field>
          <FieldLabel htmlFor="data-rota">Data</FieldLabel>
          <Input id="data-rota" type="date" value={dataPrevista} disabled={emAndamento} onChange={(e) => setDataPrevista(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="motorista-rota">Motorista</FieldLabel>
          <select
            id="motorista-rota"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm disabled:opacity-60"
            value={motoristaId}
            disabled={!podeTrocarMotorista}
            onChange={(e) => setMotoristaId(e.target.value)}
          >
            <option value="">Definir depois</option>
            {rota?.motorista && !motoristas.data?.itens.some((m) => m.id === rota.motorista?.id) ? (
              <option value={rota.motorista.id}>{rota.motorista.nome}</option>
            ) : null}
            {motoristas.data?.itens.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
          {!podeTrocarMotorista ? <FieldDescription>Depois do envio, use “Transferir”.</FieldDescription> : null}
        </Field>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="titulo-paradas">
        <div className="flex items-baseline justify-between">
          <h2 id="titulo-paradas" className="text-base font-semibold">
            Paradas
          </h2>
          <span className="text-sm text-muted-foreground tabular-nums">
            {itens.length} {itens.length === 1 ? 'parada' : 'paradas'}
          </span>
        </div>
        <BuscaEmpresa onEscolher={adicionar} naRota={naRota} />
        {itens.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Busque e adicione as empresas na ordem da visita. Depois é só arrastar para reorganizar.
          </p>
        ) : (
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
            <SortableContext items={itens.map((i) => i.chave)} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-2">
                {itens.map((item, indice) => {
                  const bloqueada = travada(item, status);
                  return (
                    <LinhaParada
                      key={item.chave}
                      item={item}
                      indice={indice}
                      total={itens.length}
                      bloqueada={bloqueada}
                      onMudar={(m) => mudar(item.chave, m)}
                      onMover={(destino) => mover(indice, destino)}
                      // Em andamento, parada existente sai por cancelamento (tela da rota), não por remoção.
                      onRemover={emAndamento && item.id ? undefined : () => setItens((a) => a.filter((i) => i.chave !== item.chave))}
                    />
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur md:left-56">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div role="status" className="min-h-5 text-sm">
            {erro ? (
              <span className="flex flex-wrap items-center gap-2 text-destructive">
                {erro.mensagem}
                {erro.conflito && onRecarregar ? (
                  <Button type="button" size="sm" variant="outline" onClick={onRecarregar}>
                    Carregar versão atual
                  </Button>
                ) : null}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {emAndamento
                  ? 'Paradas já iniciadas ficam travadas; paradas novas entram como pendentes.'
                  : rota && status !== 'RASCUNHO'
                    ? 'Ao salvar, a rota volta para “Enviada” e o motorista confirma de novo.'
                    : 'A rota fica como rascunho até você enviar.'}
              </span>
            )}
          </div>
          <Button type="button" size="lg" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : rotuloSalvar}
          </Button>
        </div>
      </div>
    </div>
  );
}

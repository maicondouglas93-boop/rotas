import {
  ROTULO_STATUS_PARADA,
  ROTULO_STATUS_ROTA,
  ROTULO_STATUS_SERVICO,
  type StatusParada,
  type StatusRota,
  type StatusServico,
} from '@rotas/shared';
import { cn } from '@/lib/utils';

type Tom = 'neutro' | 'azul' | 'ambar' | 'verde' | 'vermelho' | 'riscado';

// Cor nunca é a única informação: o badge sempre mostra o texto do status.
const TONS: Record<Tom, string> = {
  neutro: 'bg-muted text-muted-foreground',
  azul: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  ambar: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  verde: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  vermelho: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  riscado: 'bg-muted text-muted-foreground line-through decoration-1',
};

const TOM_ROTA: Record<StatusRota, Tom> = {
  RASCUNHO: 'neutro',
  ENVIADA: 'azul',
  RECEBIDA: 'azul',
  EM_ANDAMENTO: 'ambar',
  CONCLUIDA: 'verde',
  CANCELADA: 'riscado',
};

const TOM_PARADA: Record<StatusParada, Tom> = {
  PENDENTE: 'neutro',
  A_CAMINHO: 'azul',
  NO_LOCAL: 'ambar',
  FINALIZADA: 'verde',
  CANCELADA: 'riscado',
};

const TOM_SERVICO: Record<StatusServico, Tom> = {
  PENDENTE: 'neutro',
  REALIZADO: 'verde',
  NAO_REALIZADO: 'vermelho',
  CANCELADO: 'riscado',
};

type Props =
  | { tipo: 'rota'; status: StatusRota }
  | { tipo: 'parada'; status: StatusParada }
  | { tipo: 'servico'; status: StatusServico };

export function StatusBadge(props: Props) {
  const [rotulo, tom] =
    props.tipo === 'rota'
      ? [ROTULO_STATUS_ROTA[props.status], TOM_ROTA[props.status]]
      : props.tipo === 'parada'
        ? [ROTULO_STATUS_PARADA[props.status], TOM_PARADA[props.status]]
        : [ROTULO_STATUS_SERVICO[props.status], TOM_SERVICO[props.status]];
  return (
    <span className={cn('inline-flex h-5 items-center rounded-md px-1.5 text-xs font-medium whitespace-nowrap', TONS[tom])}>
      {rotulo}
    </span>
  );
}

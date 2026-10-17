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

// Cor nunca é a única informação: o selo sempre mostra o texto do status (mesmas cores do app).
const TONS: Record<Tom, { selo: string; ponto: string }> = {
  neutro: { selo: 'bg-muted text-muted-foreground', ponto: 'bg-muted-foreground' },
  azul: { selo: 'bg-[#e8f0fd] text-[#1453b8] dark:bg-sky-950 dark:text-sky-200', ponto: 'bg-[#1453b8] dark:bg-sky-300' },
  ambar: { selo: 'bg-[#fef3dc] text-[#8a4b06] dark:bg-amber-950 dark:text-amber-200', ponto: 'bg-[#8a4b06] dark:bg-amber-300' },
  verde: { selo: 'bg-[#e5f5eb] text-[#067647] dark:bg-emerald-950 dark:text-emerald-200', ponto: 'bg-[#067647] dark:bg-emerald-300' },
  vermelho: { selo: 'bg-[#fdeceb] text-[#b42318] dark:bg-red-950 dark:text-red-200', ponto: 'bg-[#b42318] dark:bg-red-300' },
  riscado: { selo: 'bg-muted text-muted-foreground line-through decoration-1', ponto: 'bg-muted-foreground' },
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
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap',
        TONS[tom].selo,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', TONS[tom].ponto)} />
      {rotulo}
    </span>
  );
}

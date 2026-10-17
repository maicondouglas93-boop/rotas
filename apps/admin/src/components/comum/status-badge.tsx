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
  azul: { selo: 'bg-info-fundo text-info', ponto: 'bg-info' },
  ambar: { selo: 'bg-alerta-fundo text-alerta', ponto: 'bg-alerta' },
  verde: { selo: 'bg-sucesso-fundo text-sucesso', ponto: 'bg-sucesso' },
  vermelho: { selo: 'bg-perigo-fundo text-destructive', ponto: 'bg-destructive' },
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

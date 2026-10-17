import { cn } from '@/lib/utils';

/** Paradas concluídas sobre o total; verde quando completa. */
export function BarraProgresso({ feitas, total, className }: { feitas: number; total: number; className?: string }) {
  const percentual = total > 0 ? Math.round((feitas / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label="Paradas concluídas"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={feitas}
      className={cn('h-2 overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width]', percentual === 100 ? 'bg-sucesso' : 'bg-primary')}
        style={{ width: `${percentual}%` }}
      />
    </div>
  );
}

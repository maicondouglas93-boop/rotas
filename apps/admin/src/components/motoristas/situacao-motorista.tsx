import type { Motorista } from '@rotas/shared';
import { cn } from '@/lib/utils';

/** Ativo / Aguardando 1º acesso / Desativado, sempre com texto (não só cor). */
export function SituacaoMotorista({ motorista }: { motorista: Motorista }) {
  const [texto, classe] = !motorista.ativo
    ? ['Desativado', 'bg-muted text-muted-foreground']
    : motorista.deveTrocarSenha
      ? ['Aguardando 1º acesso', 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200']
      : ['Ativo', 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'];
  return (
    <span className={cn('inline-flex h-5 items-center rounded-md px-1.5 text-xs font-medium whitespace-nowrap', classe)}>
      {texto}
    </span>
  );
}

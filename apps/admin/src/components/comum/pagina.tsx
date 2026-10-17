import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { mensagemDeErro } from '@/lib/erros';

/** Cabeçalho padrão de página: título, descrição curta e ação primária à direita. */
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-xl font-semibold">{titulo}</h1>
        {descricao ? <p className="text-sm text-muted-foreground">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </header>
  );
}

export function ConteudoPagina({ children, estreita = false }: { children: ReactNode; estreita?: boolean }) {
  return (
    <div className={`mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 ${estreita ? 'max-w-3xl' : 'max-w-6xl'}`}>
      {children}
    </div>
  );
}

export function ErroCarregamento({ erro, onTentarNovamente }: { erro: unknown; onTentarNovamente: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 p-4">
      <p className="text-sm">{mensagemDeErro(erro)}</p>
      <Button variant="outline" size="sm" onClick={onTentarNovamente}>
        Tentar novamente
      </Button>
    </div>
  );
}

export function Vazio({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
      <p className="text-sm font-medium">{titulo}</p>
      {descricao ? <p className="max-w-sm text-sm text-muted-foreground">{descricao}</p> : null}
      {acao ? <div className="mt-2">{acao}</div> : null}
    </div>
  );
}

export function LinhasCarregando({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function Paginacao({
  pagina,
  porPagina,
  total,
  onMudar,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  onMudar: (pagina: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total <= porPagina) return null;
  return (
    <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Paginação">
      <span className="text-muted-foreground tabular-nums">
        Página {pagina} de {paginas} · {total} {total === 1 ? 'item' : 'itens'}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => onMudar(pagina - 1)}>
          Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={pagina >= paginas} onClick={() => onMudar(pagina + 1)}>
          Próxima
        </Button>
      </div>
    </nav>
  );
}

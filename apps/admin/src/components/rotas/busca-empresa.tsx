'use client';

import type { Empresa } from '@rotas/shared';
import { PlusIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { useEmpresas } from '@/lib/consultas/empresas';
import { useDebounce } from '@/lib/use-debounce';

/** Busca empresas ativas pelo nome, bairro ou cidade e devolve a escolhida. */
export function BuscaEmpresa({ onEscolher, naRota }: { onEscolher: (empresa: Empresa) => void; naRota: Set<string> }) {
  const [texto, setTexto] = useState('');
  const busca = useDebounce(texto.trim());
  const consulta = useEmpresas({ busca, pagina: 1, porPagina: 8 });
  const aberto = texto.trim().length > 0;

  return (
    <div className="relative flex flex-col gap-2">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Adicionar empresa à rota"
          placeholder="Adicionar empresa: nome, bairro ou cidade"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setTexto('')}
        />
      </InputGroup>
      {aberto ? (
        <ul className="flex max-h-72 flex-col overflow-y-auto rounded-lg border bg-background p-1 shadow-sm" aria-label="Empresas encontradas">
          {consulta.isPending ? (
            <li className="px-2 py-2 text-sm text-muted-foreground">Buscando…</li>
          ) : consulta.isError ? (
            <li className="px-2 py-2 text-sm text-destructive">Não foi possível buscar as empresas.</li>
          ) : consulta.data.itens.length === 0 ? (
            <li className="px-2 py-2 text-sm text-muted-foreground">Nenhuma empresa ativa encontrada.</li>
          ) : (
            consulta.data.itens.map((empresa) => (
              <li key={empresa.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  onClick={() => {
                    onEscolher(empresa);
                    setTexto('');
                  }}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{empresa.nomeFantasia}</span>
                    <span className="truncate text-xs text-muted-foreground">{empresa.enderecoFormatado}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {naRota.has(empresa.id) ? 'já na rota · ' : null}
                    <PlusIcon className="size-4" aria-hidden />
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

'use client';

import { SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { useDebounce } from '@/lib/use-debounce';

/** Busca que atualiza o filtro 300 ms depois da última tecla. */
export function CampoBusca({
  valor,
  onBuscar,
  placeholder,
  rotulo,
}: {
  valor: string;
  onBuscar: (texto: string) => void;
  placeholder: string;
  rotulo: string;
}) {
  const [texto, setTexto] = useState(valor);
  const atrasado = useDebounce(texto);

  useEffect(() => {
    if (atrasado.trim() !== valor) onBuscar(atrasado.trim());
    // onBuscar muda a cada render do pai; só a busca digitada importa aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atrasado]);

  return (
    <InputGroup className="sm:max-w-xs">
      <InputGroupAddon>
        <SearchIcon aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={rotulo}
        placeholder={placeholder}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
    </InputGroup>
  );
}

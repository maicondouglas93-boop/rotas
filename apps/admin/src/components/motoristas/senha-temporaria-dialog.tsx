'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Mostra a senha temporária uma única vez: a API não a devolve de novo. */
export function SenhaTemporariaDialog({
  senha,
  nome,
  onFechar,
}: {
  senha: string | null;
  nome: string;
  onFechar: () => void;
}) {
  const [copiada, setCopiada] = useState(false);

  return (
    <Dialog open={senha !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Senha temporária de {nome}</DialogTitle>
          <DialogDescription>
            Entregue esta senha ao motorista. Ela aparece só agora e precisa ser trocada no primeiro acesso ao app.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <code className="font-mono text-lg tracking-wider select-all">{senha}</code>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!senha) return;
              await navigator.clipboard.writeText(senha);
              setCopiada(true);
            }}
          >
            {copiada ? <CheckIcon /> : <CopyIcon />}
            {copiada ? 'Copiada' : 'Copiar'}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onFechar}>Já anotei a senha</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useQueryClient } from '@tanstack/react-query';
import { caminhoAssinaturaSvg, type ComprovanteRota } from '@rotas/shared';
import { ReceiptTextIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ORIGEM_API } from '@/lib/api';
import { chavesRotas } from '@/lib/consultas/rotas';
import { formatarHora } from '@/lib/formatos';

/** Link assinado vem como caminho da API (`/api/v1/...`) no armazenamento em disco, ou URL completa num bucket. */
function urlDaFoto(fotoUrl: string): string {
  return fotoUrl.startsWith('/') ? `${ORIGEM_API}${fotoUrl}` : fotoUrl;
}

/** Botão "Comprovante" no serviço e a janela com foto, assinatura e nome de quem recebeu. */
export function BotaoComprovante({
  rotaId,
  empresa,
  comprovante,
}: {
  rotaId: string;
  empresa: string;
  comprovante: ComprovanteRota;
}) {
  const [aberto, setAberto] = useState(false);
  const queryClient = useQueryClient();
  const { assinatura } = comprovante;

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        onClick={() => {
          // O link da foto vale 5 minutos: renova ao abrir.
          void queryClient.invalidateQueries({ queryKey: chavesRotas.comprovantes(rotaId) });
          setAberto(true);
        }}
      >
        <ReceiptTextIcon aria-hidden />
        Comprovante
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Comprovante de entrega</DialogTitle>
            <DialogDescription>
              {empresa} · {formatarHora(comprovante.registradoEm)} · {comprovante.motorista.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {comprovante.fotoUrl ? (
              // Link assinado e temporário da API: next/image exigiria configurar domínio e cache, sem ganho aqui.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urlDaFoto(comprovante.fotoUrl)}
                alt={`Foto da entrega em ${empresa}`}
                className="max-h-80 w-full rounded-lg border bg-muted object-contain"
              />
            ) : null}
            {assinatura ? (
              <figure className="flex flex-col gap-1.5">
                <svg
                  role="img"
                  aria-label="Assinatura de quem recebeu"
                  viewBox={`0 0 ${assinatura.largura} ${assinatura.altura}`}
                  className="h-36 w-full rounded-lg border bg-white text-foreground dark:text-background"
                >
                  {assinatura.tracos.map((traco, i) => (
                    <path
                      key={i}
                      d={caminhoAssinaturaSvg(traco)}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>
                <figcaption className="text-xs text-muted-foreground">Assinatura de quem recebeu</figcaption>
              </figure>
            ) : null}
            {comprovante.nomeRecebedor ? (
              <p className="text-sm">
                Recebido por <span className="font-semibold">{comprovante.nomeRecebedor}</span>
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

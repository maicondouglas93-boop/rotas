import { linkWaze, linkWhatsApp, type Destino } from '@rotas/shared';
import { MapPinIcon, MessageCircleIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const classeBotao = buttonVariants({ variant: 'ghost', size: 'icon-sm' });

/** Botões de WhatsApp e Waze. Sem telefone ou endereço, o botão aparece desabilitado com o motivo. */
export function LinksExternos({ whatsapp, destino }: { whatsapp: string | null; destino: Destino }) {
  return (
    <div className="flex items-center gap-1">
      {whatsapp ? (
        <a
          href={linkWhatsApp(whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className={classeBotao}
          aria-label="Conversar no WhatsApp"
          onClick={(e) => e.stopPropagation()}
        >
          <MessageCircleIcon />
        </a>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={<span className={`${classeBotao} opacity-40`} tabIndex={0} aria-label="WhatsApp indisponível" />}
          >
            <MessageCircleIcon />
          </TooltipTrigger>
          <TooltipContent>Cadastre o WhatsApp da empresa.</TooltipContent>
        </Tooltip>
      )}
      <a
        href={linkWaze(destino)}
        target="_blank"
        rel="noopener noreferrer"
        className={classeBotao}
        aria-label="Abrir no Waze"
        onClick={(e) => e.stopPropagation()}
      >
        <MapPinIcon />
      </a>
    </div>
  );
}

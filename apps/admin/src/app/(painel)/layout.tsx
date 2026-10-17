'use client';

import { BuildingIcon, LogOutIcon, MenuIcon, RouteIcon, TruckIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { StatusApi } from '@/components/comum/status-api';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessao } from '@/lib/sessao';
import { cn } from '@/lib/utils';

const NAVEGACAO = [
  { href: '/rotas', rotulo: 'Rotas', icone: RouteIcon },
  { href: '/empresas', rotulo: 'Empresas', icone: BuildingIcon },
  { href: '/motoristas', rotulo: 'Motoristas', icone: TruckIcon },
] as const;

function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  const caminho = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Principal">
      {NAVEGACAO.map(({ href, rotulo, icone: Icone }) => {
        const ativo = caminho === href || caminho.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={aoNavegar}
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
              ativo && 'bg-muted text-foreground',
            )}
          >
            <Icone className="size-4" aria-hidden />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

export default function LayoutPainel({ children }: { children: ReactNode }) {
  const { estado, sair } = useSessao();
  const router = useRouter();
  const caminho = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (estado.situacao === 'anonimo') router.replace(`/login?volta=${encodeURIComponent(caminho)}`);
    if (estado.situacao === 'autenticado' && estado.usuario.deveTrocarSenha) router.replace('/trocar-senha');
  }, [estado, router, caminho]);

  if (estado.situacao !== 'autenticado' || estado.usuario.deveTrocarSenha) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (estado.usuario.perfil !== 'ADMIN') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-lg font-semibold">Acesso restrito à administração</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Motoristas usam o aplicativo no celular. Entre com uma conta de administrador para usar o painel.
        </p>
        <Button variant="outline" onClick={() => sair()}>
          Sair
        </Button>
      </main>
    );
  }

  const rodape = (
    <div className="flex flex-col gap-3 border-t pt-3">
      <div className="text-xs">
        <StatusApi />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-muted-foreground" title={estado.usuario.email}>
          {estado.usuario.email}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={() => sair()} aria-label="Sair">
          <LogOutIcon />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col justify-between border-r bg-sidebar p-3 md:flex">
        <div className="flex flex-col gap-4">
          <span className="px-2 text-sm font-semibold">Rotas · Painel</span>
          <Navegacao />
        </div>
        {rodape}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-2 border-b px-3 md:hidden">
          <Button variant="ghost" size="icon-sm" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
            <MenuIcon />
          </Button>
          <span className="text-sm font-semibold">Rotas · Painel</span>
        </header>
        <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
          <SheetContent side="left" className="flex w-64 flex-col justify-between p-3">
            <div className="flex flex-col gap-4">
              <SheetTitle className="px-2 text-sm">Rotas · Painel</SheetTitle>
              <Navegacao aoNavegar={() => setMenuAberto(false)} />
            </div>
            {rodape}
          </SheetContent>
        </Sheet>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

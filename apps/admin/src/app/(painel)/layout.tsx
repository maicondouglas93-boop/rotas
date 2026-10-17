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

/** Marca: ícone do caminhão num quadrado translúcido, como no app do motorista. */
function Marca() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="flex size-9 items-center justify-center rounded-xl border border-white/20 bg-white/12">
        <TruckIcon className="size-5" aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-base font-bold tracking-tight">Rotas</span>
        <span className="text-xs text-white/70">Painel de gestão</span>
      </span>
    </div>
  );
}

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
              'relative flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-white/75 transition-colors hover:bg-sidebar-accent hover:text-white',
              ativo && 'bg-sidebar-accent text-white',
            )}
          >
            {ativo ? <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-full bg-sidebar-primary" /> : null}
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
    <div className="flex flex-col gap-3 border-t border-sidebar-border pt-3">
      <div className="px-1 text-xs text-white/80 [&_p]:text-xs">
        <StatusApi />
      </div>
      <div className="flex items-center justify-between gap-2 rounded-lg bg-white/8 px-2 py-1.5">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground uppercase">
            {estado.usuario.email.charAt(0)}
          </span>
          <span className="truncate text-sm text-white/85" title={estado.usuario.email}>
            {estado.usuario.email}
          </span>
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => sair()}
          aria-label="Sair"
          className="text-white/80 hover:bg-white/15 hover:text-white"
        >
          <LogOutIcon />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="gradiente-marca sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between p-3 text-sidebar-foreground md:flex">
        <div className="flex flex-col gap-6 pt-1">
          <Marca />
          <Navegacao />
        </div>
        {rodape}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="gradiente-marca flex h-14 items-center gap-2 px-3 text-white md:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            className="text-white hover:bg-white/15 hover:text-white"
          >
            <MenuIcon />
          </Button>
          <span className="text-sm font-bold tracking-tight">Rotas · Painel</span>
        </header>
        <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
          <SheetContent side="left" className="gradiente-marca flex w-64 flex-col justify-between border-none p-3 text-sidebar-foreground">
            <div className="flex flex-col gap-6 pt-1">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Marca />
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

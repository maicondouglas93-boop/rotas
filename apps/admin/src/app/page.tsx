import { StatusApi } from '@/components/comum/status-api';

export default function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Painel de rotas</h1>
        <p className="text-sm text-muted-foreground">
          Cadastros, montagem de rotas e acompanhamento das entregas.
        </p>
      </header>
      <section className="rounded-lg border p-4">
        <StatusApi />
      </section>
    </main>
  );
}

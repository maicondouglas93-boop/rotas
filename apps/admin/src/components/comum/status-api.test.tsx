import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusApi } from './status-api';

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <StatusApi />
    </QueryClientProvider>,
  );
}

function respostaJson(status: number, corpo: unknown) {
  return Promise.resolve(new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } }));
}

describe('StatusApi', () => {
  it('mostra o estado de verificação enquanto carrega', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderizar();
    expect(screen.getByRole('status')).toHaveTextContent('Verificando conexão com a API…');
  });

  it('mostra a versão quando a API responde', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respostaJson(200, { status: 'ok', versao: 'abc1234' })));
    renderizar();
    expect(await screen.findByText('API conectada · versão abc1234')).toBeInTheDocument();
  });

  it('mostra erro e oferece nova tentativa quando a API falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        respostaJson(500, { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Falhou', detalhes: [] } }),
      ),
    );
    renderizar();
    expect(await screen.findByText('API indisponível')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('trata falha de rede como API indisponível', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    renderizar();
    expect(await screen.findByText('API indisponível')).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { StatusApi } from './status-api';

async function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return await render(
    <QueryClientProvider client={cliente}>
      <StatusApi />
    </QueryClientProvider>,
  );
}

function respostaJson(status: number, corpo: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response);
}

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe('StatusApi', () => {
  it('mostra a versão quando o servidor responde', async () => {
    globalThis.fetch = jest.fn(() => respostaJson(200, { status: 'ok', versao: 'abc1234' }));
    await renderizar();
    expect(await screen.findByText('Conectado ao servidor · versão abc1234')).toBeTruthy();
  });

  it('mostra falta de conexão e botão para tentar de novo', async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    await renderizar();
    expect(await screen.findByText('Sem conexão com o servidor')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
  });
});

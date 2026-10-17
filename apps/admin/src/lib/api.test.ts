import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sessao = {
  accessToken: 'token-novo',
  expiraEm: '2026-10-17T12:00:00.000Z',
  usuario: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'admin@rotas.test', perfil: 'ADMIN', nome: null, deveTrocarSenha: false },
};

function resposta(status: number, corpo: unknown = null) {
  return new Response(corpo === null ? null : JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('cliente da API do painel', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renovações simultâneas fazem uma única chamada de refresh', async () => {
    let liberar: (r: Response) => void = () => undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => (liberar = r)));
    vi.stubGlobal('fetch', fetchMock);
    const { renovarSessao } = await import('./api');

    const a = renovarSessao();
    const b = renovarSessao();
    liberar(resposta(200, sessao));

    await expect(a).resolves.toMatchObject({ accessToken: 'token-novo' });
    await expect(b).resolves.toMatchObject({ accessToken: 'token-novo' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sem sessão (401) devolve null em vez de erro', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(resposta(401, { erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'x', detalhes: [] } }))));
    const { renovarSessao } = await import('./api');
    await expect(renovarSessao()).resolves.toBeNull();
  });

  it('em 401 renova a sessão e repete a chamada com o token novo', async () => {
    const chamadas: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        const auth = new Headers(init.headers).get('Authorization');
        chamadas.push(`${url.split('/api/v1')[1]} ${auth ?? '-'}`);
        if (url.endsWith('/auth/refresh')) return Promise.resolve(resposta(200, sessao));
        return Promise.resolve(auth === 'Bearer token-novo' ? resposta(200, { ok: true }) : resposta(401, { erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'x', detalhes: [] } }));
      }),
    );
    const { definirAccessToken, requisitar } = await import('./api');
    definirAccessToken('token-velho');

    await expect(requisitar('/empresas')).resolves.toEqual({ ok: true });
    expect(chamadas).toEqual(['/empresas Bearer token-velho', '/auth/refresh -', '/empresas Bearer token-novo']);
  });

  it('quando a renovação falha, avisa a perda de sessão e propaga o 401', async () => {
    const erro401 = { erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'Sessão expirada.', detalhes: [] } };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(resposta(401, erro401))));
    const { observarPerdaDeSessao, requisitar } = await import('./api');
    const aviso = vi.fn();
    observarPerdaDeSessao(aviso);

    await expect(requisitar('/empresas')).rejects.toMatchObject({ status: 401, codigo: 'NAO_AUTENTICADO' });
    expect(aviso).toHaveBeenCalledTimes(1);
  });
});

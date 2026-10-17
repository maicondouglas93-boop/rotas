import { ErroApi } from '@rotas/shared';

const URL_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Cliente HTTP do painel. Respostas de erro viram ErroApi (envelope padrão da API). */
export async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${URL_API}${caminho}`, {
      ...init,
      credentials: 'include',
      headers: { Accept: 'application/json', ...init?.headers },
    });
  } catch {
    throw ErroApi.semConexao();
  }

  const corpo: unknown = resposta.status === 204 ? null : await resposta.json().catch(() => null);
  if (!resposta.ok) throw ErroApi.daResposta(resposta.status, corpo);
  return corpo as T;
}

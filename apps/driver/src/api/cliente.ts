import { ErroApi } from '@rotas/shared';

// EXPO_PUBLIC_* é embutido no bundle: só endereços públicos, nunca segredos.
const URL_API = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000/api/v1';
const TIMEOUT_MS = 15_000;

/** Cliente HTTP do app. Erros viram ErroApi; sem rede ou timeout viram SEM_CONEXAO. */
export async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const controle = new AbortController();
  const temporizador = setTimeout(() => controle.abort(), TIMEOUT_MS);
  let resposta: Response;
  try {
    resposta = await fetch(`${URL_API}${caminho}`, {
      ...init,
      signal: controle.signal,
      headers: { Accept: 'application/json', ...init?.headers },
    });
  } catch {
    throw ErroApi.semConexao();
  } finally {
    clearTimeout(temporizador);
  }

  const corpo: unknown = resposta.status === 204 ? null : await resposta.json().catch(() => null);
  if (!resposta.ok) throw ErroApi.daResposta(resposta.status, corpo);
  return corpo as T;
}

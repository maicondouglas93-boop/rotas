import { CABECALHO_IDEMPOTENCIA, ErroApi, sessaoSchema, type Sessao } from '@rotas/shared';
import { apagarRefreshToken, gravarRefreshToken, lerRefreshToken } from '../sessao/armazenamento';

// EXPO_PUBLIC_* é embutido no bundle: só endereços públicos, nunca segredos.
const URL_API = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000/api/v1';
const TIMEOUT_MS = 15_000;

let accessToken: string | null = null;
let renovacaoEmCurso: Promise<Sessao | null> | null = null;
const aoPerderSessao = new Set<() => void>();

export function definirAccessToken(token: string | null): void {
  accessToken = token;
}

export function observarPerdaDeSessao(callback: () => void): () => void {
  aoPerderSessao.add(callback);
  return () => aoPerderSessao.delete(callback);
}

interface Opcoes {
  method?: 'GET' | 'POST';
  corpo?: unknown;
  chaveIdempotencia?: string;
  comToken?: boolean;
}

async function chamar(caminho: string, opcoes: Opcoes): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opcoes.corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (opcoes.comToken !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (opcoes.chaveIdempotencia) headers[CABECALHO_IDEMPOTENCIA] = opcoes.chaveIdempotencia;

  const controle = new AbortController();
  const temporizador = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${URL_API}${caminho}`, {
      method: opcoes.method ?? 'GET',
      headers,
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      signal: controle.signal,
    });
  } catch {
    throw ErroApi.semConexao();
  } finally {
    clearTimeout(temporizador);
  }
}

async function lerResposta<T>(resposta: Response): Promise<T> {
  const corpo: unknown = resposta.status === 204 ? null : await resposta.json().catch(() => null);
  if (!resposta.ok) throw ErroApi.daResposta(resposta.status, corpo);
  return corpo as T;
}

/** Guarda a sessão recebida no login ou na renovação. */
export async function aplicarSessao(sessao: Sessao): Promise<void> {
  definirAccessToken(sessao.accessToken);
  if (sessao.refreshToken) await gravarRefreshToken(sessao.refreshToken);
}

async function pedirRenovacao(): Promise<Sessao | null> {
  const refreshToken = await lerRefreshToken();
  if (!refreshToken) return null;
  const resposta = await chamar('/auth/refresh', { method: 'POST', corpo: { refreshToken }, comToken: false });
  if (resposta.status === 401 || resposta.status === 403) {
    await apagarRefreshToken();
    return null;
  }
  const sessao = sessaoSchema.parse(await lerResposta<unknown>(resposta));
  await aplicarSessao(sessao);
  return sessao;
}

/**
 * Renova a sessão uma chamada por vez: dois refresh simultâneos com o mesmo token
 * contam como reuso e derrubam a sessão (auth-security-lgpd).
 */
export function renovarSessao(): Promise<Sessao | null> {
  renovacaoEmCurso ??= pedirRenovacao().finally(() => {
    renovacaoEmCurso = null;
  });
  return renovacaoEmCurso;
}

/** Chamada autenticada. Em 401 renova uma vez e repete; sem sessão, avisa o app e propaga o erro. */
export async function requisitar<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  let resposta = await chamar(caminho, opcoes);
  if (resposta.status === 401) {
    const sessao = await renovarSessao();
    if (!sessao) {
      definirAccessToken(null);
      aoPerderSessao.forEach((callback) => callback());
      return lerResposta<T>(resposta);
    }
    resposta = await chamar(caminho, opcoes);
  }
  return lerResposta<T>(resposta);
}

export async function requisitarPublico<T>(caminho: string, opcoes: Omit<Opcoes, 'comToken'> = {}): Promise<T> {
  return lerResposta<T>(await chamar(caminho, { ...opcoes, comToken: false }));
}

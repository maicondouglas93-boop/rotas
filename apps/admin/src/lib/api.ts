import { ErroApi, sessaoSchema, type Sessao } from '@rotas/shared';

const URL_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const TRAVA_RENOVACAO = 'rotas-renovar-sessao';

// Access token só em memória (auth-security-lgpd). O refresh fica no cookie HttpOnly da API.
let accessToken: string | null = null;
let renovacaoEmCurso: Promise<Sessao | null> | null = null;
const aoPerderSessao = new Set<() => void>();

export function definirAccessToken(token: string | null): void {
  accessToken = token;
}

/** Avisa a interface quando a sessão acabou de vez (refresh recusado). */
export function observarPerdaDeSessao(callback: () => void): () => void {
  aoPerderSessao.add(callback);
  return () => aoPerderSessao.delete(callback);
}

async function chamar(caminho: string, init: RequestInit, comToken: boolean): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (comToken && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  try {
    return await fetch(`${URL_API}${caminho}`, { ...init, headers, credentials: 'include' });
  } catch {
    throw ErroApi.semConexao();
  }
}

async function lerResposta<T>(resposta: Response): Promise<T> {
  const corpo: unknown = resposta.status === 204 ? null : await resposta.json().catch(() => null);
  if (!resposta.ok) throw ErroApi.daResposta(resposta.status, corpo);
  return corpo as T;
}

async function pedirRenovacao(): Promise<Sessao | null> {
  const resposta = await chamar('/auth/refresh', { method: 'POST' }, false);
  if (resposta.status === 401 || resposta.status === 403) return null;
  const sessao = sessaoSchema.parse(await lerResposta<unknown>(resposta));
  definirAccessToken(sessao.accessToken);
  return sessao;
}

/**
 * Renova a sessão em voo único: uma chamada por vez nesta aba e, com Web Locks, entre abas.
 * Dois refresh simultâneos com o mesmo cookie contariam como reuso e derrubariam a sessão.
 */
export function renovarSessao(): Promise<Sessao | null> {
  renovacaoEmCurso ??= (async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.locks) {
        return await navigator.locks.request(TRAVA_RENOVACAO, pedirRenovacao);
      }
      return await pedirRenovacao();
    } finally {
      renovacaoEmCurso = null;
    }
  })();
  return renovacaoEmCurso;
}

/**
 * Chamada autenticada à API. Em 401, renova a sessão uma vez e repete; se não der, avisa a interface.
 * Respostas de erro viram ErroApi (envelope padrão).
 */
export async function requisitar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  let resposta = await chamar(caminho, init, true);
  if (resposta.status === 401) {
    const sessao = await renovarSessao().catch(() => null);
    if (!sessao) {
      definirAccessToken(null);
      aoPerderSessao.forEach((callback) => callback());
      return lerResposta<T>(resposta);
    }
    resposta = await chamar(caminho, init, true);
  }
  return lerResposta<T>(resposta);
}

/** Chamada sem token (login, logout, saúde). */
export async function requisitarPublico<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  return lerResposta<T>(await chamar(caminho, init, false));
}

export const json = (dados: unknown): string => JSON.stringify(dados);

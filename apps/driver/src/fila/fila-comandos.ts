import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErroApi, rotaSchema, type Rota } from '@rotas/shared';
import * as Crypto from 'expo-crypto';
import { requisitar } from '../api/cliente';

// Fila de comandos do motorista (react-native-driver-app, "Conectividade limitada").
// Todo comando passa por aqui, com ou sem rede: um caminho só, em ordem, com a mesma
// Idempotency-Key em cada reenvio. Nada é dado como feito antes da resposta da API.

export interface ComandoNaFila {
  chave: string;
  caminho: string;
  corpo: Record<string, unknown>;
  rotaId: string;
  /** Parada, serviço ou rota que o comando afeta (para a tela mostrar "aguardando envio"). */
  alvoId: string;
  descricao: string;
  criadoEm: string;
  tentativas: number;
}

export type NovoComando = Pick<ComandoNaFila, 'caminho' | 'rotaId' | 'alvoId' | 'descricao'> & {
  corpo?: Record<string, unknown>;
};

interface Ouvintes {
  aoAtualizarRota(rota: Rota): void;
  aoRecusar(comando: ComandoNaFila, mensagem: string): void;
}

const CHAVE_ARMAZENAMENTO = 'rotas.fila-comandos';
export const ESPERAS_MS = [1_000, 2_000, 5_000, 15_000, 30_000] as const;

let fila: ComandoNaFila[] = [];
let carregada = false;
let processamento: Promise<void> | null = null;
let reagendamento: ReturnType<typeof setTimeout> | null = null;
let ouvintes: Ouvintes = { aoAtualizarRota: () => undefined, aoRecusar: () => undefined };
const assinantes = new Set<() => void>();

function notificar(): void {
  assinantes.forEach((a) => a());
}

async function persistir(): Promise<void> {
  await AsyncStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(fila));
  notificar();
}

export function configurarFila(novos: Ouvintes): void {
  ouvintes = novos;
}

export function assinarFila(callback: () => void): () => void {
  assinantes.add(callback);
  return () => assinantes.delete(callback);
}

export function lerFila(): readonly ComandoNaFila[] {
  return fila;
}

export async function carregarFila(): Promise<void> {
  if (carregada) return;
  const bruto = await AsyncStorage.getItem(CHAVE_ARMAZENAMENTO);
  fila = bruto ? (JSON.parse(bruto) as ComandoNaFila[]) : [];
  carregada = true;
  notificar();
}

export async function limparFila(): Promise<void> {
  if (reagendamento) clearTimeout(reagendamento);
  reagendamento = null;
  fila = [];
  await AsyncStorage.removeItem(CHAVE_ARMAZENAMENTO);
  notificar();
}

/** Registra o comando (chave gerada no toque, horário do aparelho) e tenta enviar. */
export async function enfileirar(novo: NovoComando): Promise<ComandoNaFila> {
  await carregarFila();
  const agora = new Date().toISOString();
  const comando: ComandoNaFila = {
    ...novo,
    corpo: { ...novo.corpo, ocorridoEm: agora },
    chave: Crypto.randomUUID(),
    criadoEm: agora,
    tentativas: 0,
  };
  fila = [...fila, comando];
  await persistir();
  void processarFila();
  return comando;
}

function deveRepetir(erro: unknown): boolean {
  // Sem rede, tempo esgotado ou erro do servidor: o comando continua na fila.
  return !(erro instanceof ErroApi) || erro.codigo === 'SEM_CONEXAO' || erro.status >= 500;
}

/** Remove o comando da frente da fila, se ele ainda estiver lá (o logout pode ter limpado a fila no meio do envio). */
async function retirarDaFrente(chave: string): Promise<boolean> {
  if (fila[0]?.chave !== chave) return false;
  fila = fila.slice(1);
  await persistir();
  return true;
}

async function executarFila(): Promise<void> {
  if (reagendamento) clearTimeout(reagendamento);
  reagendamento = null;
  await carregarFila();
  while (fila.length > 0) {
    const comando = fila[0]!;
    try {
      const resposta = await requisitar<unknown>(comando.caminho, {
        method: 'POST',
        corpo: comando.corpo,
        chaveIdempotencia: comando.chave,
      });
      if (!(await retirarDaFrente(comando.chave))) return;
      const rota = rotaSchema.safeParse(resposta);
      if (rota.success) ouvintes.aoAtualizarRota(rota.data);
    } catch (erro) {
      if (fila[0]?.chave !== comando.chave) return; // fila limpa durante o envio
      if (erro instanceof ErroApi && erro.status === 401) return; // sessão encerrada: o logout limpa a fila
      if (deveRepetir(erro)) {
        const tentativas = comando.tentativas + 1;
        fila = [{ ...comando, tentativas }, ...fila.slice(1)];
        await persistir();
        const espera = ESPERAS_MS[Math.min(tentativas - 1, ESPERAS_MS.length - 1)]!;
        reagendamento = setTimeout(() => void processarFila(), espera);
        return;
      }
      // Recusado pela API (ex.: parada cancelada pelo admin enquanto estava sem sinal): sai da fila.
      await retirarDaFrente(comando.chave);
      ouvintes.aoRecusar(comando, erro instanceof ErroApi ? erro.message : 'Ação recusada.');
    }
  }
}

/**
 * Envia em ordem e para no primeiro que precisar de nova tentativa (a ordem importa).
 * Chamado com um envio em andamento, devolve o mesmo processamento.
 */
export function processarFila(): Promise<void> {
  processamento ??= executarFila().finally(() => {
    processamento = null;
  });
  return processamento;
}

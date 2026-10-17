import { onlineManager, useQueryClient } from '@tanstack/react-query';
import {
  EventoTempoReal,
  MOTIVO_TEMPO_REAL_NAO_AUTENTICADO,
  payloadTempoRealSchema,
  type Rota,
} from '@rotas/shared';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { publicarAviso } from './avisos';
import { obterAccessToken, ORIGEM_API, renovarSessao } from './cliente';
import { chaves } from './consultas';

/** Mudanças feitas pela administração: viram aviso na tela (as do próprio motorista não). */
const AVISO_DO_EVENTO: Partial<Record<EventoTempoReal, string>> = {
  [EventoTempoReal.ROTA_ENVIADA]: 'Nova rota da administração',
  [EventoTempoReal.ROTA_EDITADA]: 'A administração alterou a rota',
  [EventoTempoReal.ROTA_CANCELADA]: 'A administração cancelou a rota',
  [EventoTempoReal.ROTA_TRANSFERIDA]: 'A administração transferiu a rota',
  [EventoTempoReal.PARADA_CANCELADA]: 'A administração cancelou uma parada',
};

export function textoDoAviso(evento: string, nomes: { rota?: string; parada?: string } = {}): string | null {
  if (evento === EventoTempoReal.PARADA_CANCELADA && nomes.parada) {
    return `A administração cancelou a parada ${nomes.parada}${nomes.rota ? ` (${nomes.rota})` : ''}.`;
  }
  const base = AVISO_DO_EVENTO[evento as EventoTempoReal];
  if (!base) return null;
  return nomes.rota ? `${base}: ${nomes.rota}.` : `${base}.`;
}

const NOMES_EVENTOS = new Set<string>(Object.values(EventoTempoReal));
/** Evita laço de renovação se o servidor seguir recusando um token recém-renovado. */
const ESPERA_ENTRE_RENOVACOES_MS = 30_000;

/**
 * Socket.IO do motorista: o servidor só manda eventos das rotas dele. Cada evento recarrega a rota
 * e a lista (o detalhe vem do REST); mudança da administração também mostra um aviso e vibra.
 */
export function useTempoReal(ativo: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ativo) return;
    const socket = io(ORIGEM_API, {
      auth: (cb) => cb({ token: obterAccessToken() ?? '' }),
      transports: ['websocket'],
    });
    let ultimaRenovacaoOk = 0;
    let renovando = false;
    let jaConectou = false;

    // Token vencido, ausente (app aberto sem rede) ou recusado: renova a sessão e reconecta.
    // A espera só vale depois de uma renovação bem-sucedida; sem rede, tenta de novo quando ela voltar.
    async function renovarEReconectar() {
      if (renovando || Date.now() - ultimaRenovacaoOk < ESPERA_ENTRE_RENOVACOES_MS) return;
      renovando = true;
      try {
        const sessao = await renovarSessao().catch(() => null);
        if (sessao) {
          ultimaRenovacaoOk = Date.now();
          socket.connect();
        }
      } finally {
        renovando = false;
      }
    }

    function reconectarSePreciso() {
      if (socket.connected || !onlineManager.isOnline()) return;
      if (obterAccessToken()) socket.connect();
      else void renovarEReconectar();
    }

    socket.on('connect', () => {
      // Na reconexão, eventos podem ter sido perdidos enquanto o app estava sem sinal.
      if (jaConectou) void queryClient.invalidateQueries({ queryKey: ['motorista'] });
      jaConectou = true;
    });
    socket.on('disconnect', (motivo) => {
      if (motivo === 'io server disconnect') void renovarEReconectar();
    });
    socket.on('connect_error', (erro) => {
      if (erro.message === MOTIVO_TEMPO_REAL_NAO_AUTENTICADO) void renovarEReconectar();
    });
    socket.onAny((evento: string, payload: unknown) => {
      const dados = payloadTempoRealSchema.safeParse(payload);
      if (!NOMES_EVENTOS.has(evento) || !dados.success) return;
      // Nomes lidos do cache antes de recarregar (a parada cancelada ainda está lá).
      const rota = queryClient.getQueryData<Rota>(chaves.rota(dados.data.rotaId));
      const parada = rota?.paradas.find((p) => p.id === dados.data.paradaId);
      void queryClient.invalidateQueries({ queryKey: chaves.rota(dados.data.rotaId) });
      void queryClient.invalidateQueries({ queryKey: ['motorista', 'rotas'] });
      const texto = textoDoAviso(evento, { rota: rota?.nome, parada: parada?.nomeEmpresa });
      if (texto) {
        publicarAviso(texto);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      }
    });

    // Voltou a rede ou o app voltou ao primeiro plano (ex.: saindo do Waze): garante a conexão.
    const pararOnline = onlineManager.subscribe((online) => {
      if (online) reconectarSePreciso();
    });
    const assinaturaApp = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') reconectarSePreciso();
    });

    return () => {
      pararOnline();
      assinaturaApp.remove();
      socket.offAny();
      socket.disconnect();
    };
  }, [ativo, queryClient]);
}

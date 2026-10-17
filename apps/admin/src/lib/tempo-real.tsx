'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  EventoTempoReal,
  MOTIVO_TEMPO_REAL_NAO_AUTENTICADO,
  payloadTempoRealSchema,
  type Rota,
} from '@rotas/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { io } from 'socket.io-client';
import { obterAccessToken, ORIGEM_API, renovarSessao } from './api';
import { chavesRotas } from './consultas/rotas';
import { ContextoTempoReal, type EstadoConexao } from './estado-tempo-real';

/** Evita laço de renovação se o servidor seguir recusando o token. */
const ESPERA_ENTRE_RENOVACOES_MS = 30_000;

const ANUNCIO: Partial<Record<EventoTempoReal, string>> = {
  [EventoTempoReal.ROTA_RECEBIDA]: 'Motorista confirmou o recebimento',
  [EventoTempoReal.ROTA_INICIADA]: 'Rota iniciada',
  [EventoTempoReal.ROTA_CONCLUIDA]: 'Rota concluída',
  [EventoTempoReal.PARADA_A_CAMINHO]: 'Motorista a caminho de uma parada',
  [EventoTempoReal.PARADA_CHEGADA]: 'Motorista chegou a uma parada',
  [EventoTempoReal.PARADA_FINALIZADA]: 'Parada finalizada',
  [EventoTempoReal.SERVICO_NAO_REALIZADO]: 'Serviço não realizado',
  [EventoTempoReal.OCORRENCIA_REGISTRADA]: 'Nova ocorrência registrada',
};

const NOMES_EVENTOS = new Set<string>(Object.values(EventoTempoReal));

/**
 * Conexão Socket.IO do painel. Evento recebido só invalida as consultas da rota (o detalhe vem do REST);
 * novidades do motorista são anunciadas numa região aria-live.
 */
export function TempoRealProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoConexao>('conectando');
  const [anuncio, setAnuncio] = useState('');

  useEffect(() => {
    const socket = io(ORIGEM_API, {
      auth: (cb) => cb({ token: obterAccessToken() ?? '' }),
      transports: ['websocket'],
    });
    let ultimaRenovacao = 0;

    // Token vencido ou recusado: renova a sessão (voo único) e reconecta com o token novo.
    async function renovarEReconectar() {
      if (Date.now() - ultimaRenovacao < ESPERA_ENTRE_RENOVACOES_MS) return;
      ultimaRenovacao = Date.now();
      const sessao = await renovarSessao().catch(() => null);
      if (sessao) socket.connect();
    }

    let jaConectou = false;
    socket.on('connect', () => {
      setEstado('ao-vivo');
      // Na reconexão, eventos podem ter sido perdidos: recarrega o que estiver na tela.
      if (jaConectou) void queryClient.invalidateQueries({ queryKey: chavesRotas.todas });
      jaConectou = true;
    });
    socket.on('disconnect', (motivo) => {
      setEstado('reconectando');
      if (motivo === 'io server disconnect') void renovarEReconectar();
    });
    socket.on('connect_error', (erro) => {
      setEstado('reconectando');
      if (erro.message === MOTIVO_TEMPO_REAL_NAO_AUTENTICADO) void renovarEReconectar();
    });
    socket.onAny((evento: string, payload: unknown) => {
      const dados = payloadTempoRealSchema.safeParse(payload);
      if (!NOMES_EVENTOS.has(evento) || !dados.success) return;
      void queryClient.invalidateQueries({ queryKey: chavesRotas.detalhe(dados.data.rotaId) });
      void queryClient.invalidateQueries({ queryKey: [...chavesRotas.todas, 'lista'] });
      const texto = ANUNCIO[evento as EventoTempoReal];
      if (texto) {
        const nome = queryClient.getQueryData<Rota>(chavesRotas.detalhe(dados.data.rotaId))?.nome;
        setAnuncio(nome ? `${texto}: ${nome}.` : `${texto}.`);
      }
    });

    return () => {
      socket.offAny();
      socket.disconnect();
    };
  }, [queryClient]);

  return (
    <ContextoTempoReal.Provider value={estado}>
      {children}
      <div aria-live="polite" role="status" className="sr-only">
        {anuncio}
      </div>
    </ContextoTempoReal.Provider>
  );
}

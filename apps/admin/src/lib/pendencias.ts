import { STATUS_ROTA_TERMINAIS, type RotaDoDia } from '@rotas/shared';
import { formatarHaQuanto } from './formatos';

/** Depois disso sem notícia do motorista, a rota entra em "Precisa de atenção". */
export const MINUTOS_SEM_RESPOSTA = 30;

export interface Pendencia {
  rota: RotaDoDia;
  motivo: string;
}

/** Rotas do dia que pedem uma ação do admin, com o motivo em uma frase (uma pendência por rota). */
export function pendenciasDoDia(rotas: RotaDoDia[], agora: number): Pendencia[] {
  const passou = (iso: string | null): iso is string =>
    iso !== null && agora - new Date(iso).getTime() > MINUTOS_SEM_RESPOSTA * 60_000;
  const pendencias: Pendencia[] = [];
  for (const rota of rotas) {
    if (STATUS_ROTA_TERMINAIS.includes(rota.status)) continue;
    if (rota.motorista && !rota.motorista.ativo) {
      pendencias.push({ rota, motivo: 'Motorista desativado: transfira ou cancele a rota.' });
    } else if (rota.status === 'RASCUNHO') {
      pendencias.push({
        rota,
        motivo: rota.motorista ? 'Rascunho ainda não enviado ao motorista.' : 'Rascunho sem motorista definido.',
      });
    } else if (rota.status === 'ENVIADA' && passou(rota.enviadaEm)) {
      pendencias.push({ rota, motivo: `Enviada ${formatarHaQuanto(rota.enviadaEm, agora)} e ainda não confirmada.` });
    } else if (rota.status === 'EM_ANDAMENTO' && passou(rota.ultimaAtividadeEm)) {
      pendencias.push({ rota, motivo: `Sem atividade do motorista ${formatarHaQuanto(rota.ultimaAtividadeEm, agora)}.` });
    }
  }
  return pendencias;
}

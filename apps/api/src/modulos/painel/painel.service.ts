import { Injectable } from '@nestjs/common';
import {
  STATUS_PARADA_TERMINAIS,
  type FiltroPainelHoje,
  type PainelHoje,
  type RotaDoDia,
  type StatusRota,
} from '@rotas/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { mapearRotaResumo, paraData, rotaResumoSelect } from '../rotas/rotas.mapper.js';

const FUSO = 'America/Sao_Paulo';
const LIMITE_OCORRENCIAS = 50;

/** Ordem da lista: o que pede acompanhamento primeiro. */
const ORDEM_STATUS: Record<StatusRota, number> = {
  EM_ANDAMENTO: 0,
  RECEBIDA: 1,
  ENVIADA: 2,
  RASCUNHO: 3,
  CONCLUIDA: 4,
  CANCELADA: 5,
};

/** Data de hoje (AAAA-MM-DD) no fuso da operação, não no do servidor. */
export function hojeEmSaoPaulo(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);
}

/** Visão operacional do dia para a página inicial do painel. */
@Injectable()
export class PainelService {
  constructor(private readonly prisma: PrismaService) {}

  async hoje(filtro: FiltroPainelHoje): Promise<PainelHoje> {
    const data = filtro.data ?? hojeEmSaoPaulo();
    const registros = await this.prisma.rota.findMany({
      where: { dataPrevista: paraData(data) },
      select: {
        ...rotaResumoSelect,
        paradas: {
          orderBy: { sequencia: 'asc' },
          select: { id: true, nomeEmpresa: true, status: true, _count: { select: { ocorrencias: true } } },
        },
      },
    });
    const ids = registros.map((r) => r.id);

    // Três consultas no total, qualquer que seja o número de rotas (sem N+1).
    const [atividades, ocorrencias] = await Promise.all([
      this.prisma.rotaEvento.groupBy({ by: ['rotaId'], where: { rotaId: { in: ids } }, _max: { criadoEm: true } }),
      this.prisma.ocorrencia.findMany({
        where: { parada: { rotaId: { in: ids } } },
        orderBy: [{ ocorridaEm: 'desc' }, { id: 'asc' }],
        take: LIMITE_OCORRENCIAS,
        select: {
          id: true,
          tipo: true,
          descricao: true,
          ocorridaEm: true,
          servico: { select: { tipo: true } },
          parada: { select: { id: true, nomeEmpresa: true, rota: { select: { id: true, nome: true } } } },
          motorista: { select: { nome: true } },
        },
      }),
    ]);
    const ultimaAtividade = new Map(atividades.map((a) => [a.rotaId, a._max.criadoEm]));

    const rotas: RotaDoDia[] = registros
      .map(({ paradas, ...resumo }) => {
        const atual = paradas.find((p) => p.status === 'NO_LOCAL' || p.status === 'A_CAMINHO');
        const concluidas = paradas.filter((p) => STATUS_PARADA_TERMINAIS.includes(p.status)).length;
        return {
          ...mapearRotaResumo(resumo, { total: paradas.length, concluidas }),
          paradaAtual: atual ? { id: atual.id, nomeEmpresa: atual.nomeEmpresa, status: atual.status } : null,
          ocorrencias: paradas.reduce((total, p) => total + p._count.ocorrencias, 0),
          ultimaAtividadeEm: ultimaAtividade.get(resumo.id)?.toISOString() ?? null,
        };
      })
      .sort((a, b) => ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status] || a.nome.localeCompare(b.nome, 'pt-BR'));

    return {
      data,
      rotas,
      ocorrencias: ocorrencias.map((o) => ({
        id: o.id,
        tipo: o.tipo,
        descricao: o.descricao,
        ocorridaEm: o.ocorridaEm.toISOString(),
        servicoTipo: o.servico?.tipo ?? null,
        rotaId: o.parada.rota.id,
        rotaNome: o.parada.rota.nome,
        paradaId: o.parada.id,
        nomeEmpresa: o.parada.nomeEmpresa,
        motoristaNome: o.motorista.nome,
      })),
    };
  }
}

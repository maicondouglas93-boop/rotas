import { Injectable } from '@nestjs/common';
import type { EditarRotaEntrada, Rota } from '@rotas/shared';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { planejarEdicaoParadas, validarCamposEdicao, type PlanoEdicao } from './dominio/edicao.js';
import { transicaoRota } from './dominio/transicoes.js';
import {
  carregarEmpresasParaParadas,
  dadosParadaNova,
  garantirMotoristaAtivo,
  liberarSequencias,
  obterRota,
  registrarEvento,
  travarRota,
  type Tx,
} from './rotas.apoio.js';
import { deData, mapearRota, paraData } from './rotas.mapper.js';

@Injectable()
export class RotasEdicaoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Comando EDITAR_ESTRUTURA: recebe o estado desejado completo. Em ENVIADA/RECEBIDA a rota volta para
   * ENVIADA (o motorista reconfirma); em EM_ANDAMENTO valem as restrições de `planejarEdicaoParadas`.
   */
  async editar(id: string, dados: EditarRotaEntrada, usuario: UsuarioAutenticado): Promise<Rota> {
    return this.prisma.$transaction(async (tx) => {
      const atual = await travarRota(tx, id, dados.versao);

      const transicao = transicaoRota(atual.status, 'EDITAR_ESTRUTURA', 'ADMIN');
      if (!transicao.ok) throw ErroDominio.transicaoInvalida(transicao.motivo);
      const destino = transicao.valor ?? atual.status;

      const motoristaAtual = atual.motorista?.id ?? null;
      const campos = validarCamposEdicao(
        atual.status,
        { dataPrevista: deData(atual.dataPrevista), motoristaId: motoristaAtual },
        { dataPrevista: dados.dataPrevista, motoristaId: dados.motoristaId },
      );
      if (!campos.ok) throw ErroDominio.regraNegocio(campos.motivo);

      const plano = planejarEdicaoParadas(
        atual.status,
        atual.paradas.map((p) => ({
          id: p.id,
          empresaId: p.empresaId,
          status: p.status,
          servicos: p.servicos.map((s) => s.tipo),
          observacoes: p.observacoes,
        })),
        dados.paradas,
      );
      if (!plano.ok) throw ErroDominio.regraNegocio(plano.motivo);

      if (dados.motoristaId && dados.motoristaId !== motoristaAtual) {
        await garantirMotoristaAtivo(tx, dados.motoristaId);
      }
      const empresas = await carregarEmpresasParaParadas(
        tx,
        plano.valor.novas.map((n) => n.empresaId),
      );

      await this.aplicarPlano(tx, id, plano.valor, empresas);
      await tx.rota.update({
        where: { id },
        data: {
          nome: dados.nome,
          dataPrevista: paraData(dados.dataPrevista),
          motoristaId: dados.motoristaId,
          status: destino,
          // Voltar para ENVIADA exige nova confirmação do motorista.
          ...(atual.status === 'RECEBIDA' ? { recebidaEm: null } : {}),
        },
      });

      await registrarEvento(tx, {
        rotaId: id,
        tipo: 'ROTA_EDITADA',
        statusAnterior: atual.status,
        statusNovo: destino,
        autorUsuarioId: usuario.usuarioId,
        dados: {
          adicionadas: plano.valor.novas.length,
          removidas: plano.valor.removidas.length,
          reordenou: plano.valor.reordenou,
          servicosAlterados: plano.valor.mantidas.filter(
            (m) => m.servicosAdicionar.length > 0 || m.servicosRemover.length > 0,
          ).length,
        },
      });
      return mapearRota(await obterRota(tx, id));
    });
  }

  private async aplicarPlano(
    tx: Tx,
    rotaId: string,
    plano: PlanoEdicao,
    empresas: Awaited<ReturnType<typeof carregarEmpresasParaParadas>>,
  ): Promise<void> {
    if (plano.removidas.length > 0) {
      await tx.parada.deleteMany({ where: { rotaId, id: { in: plano.removidas } } });
    }

    for (const mantida of plano.mantidas) {
      if (mantida.servicosRemover.length > 0) {
        await tx.servico.deleteMany({
          where: { paradaId: mantida.id, tipo: { in: mantida.servicosRemover }, status: 'PENDENTE' },
        });
      }
      if (mantida.servicosAdicionar.length > 0) {
        await tx.servico.createMany({ data: mantida.servicosAdicionar.map((tipo) => ({ paradaId: mantida.id, tipo })) });
      }
      if (mantida.observacoes !== undefined) {
        await tx.parada.update({ where: { id: mantida.id }, data: { observacoes: mantida.observacoes } });
      }
    }

    await liberarSequencias(tx, rotaId);
    for (const [indice, item] of plano.ordem.entries()) {
      const sequencia = indice + 1;
      if ('id' in item) {
        await tx.parada.update({ where: { id: item.id }, data: { sequencia } });
      } else {
        const nova = plano.novas[item.nova]!;
        await tx.parada.create({
          data: dadosParadaNova(rotaId, sequencia, empresas.get(nova.empresaId)!, nova.servicos, nova.observacoes),
          select: { id: true },
        });
      }
    }
  }
}

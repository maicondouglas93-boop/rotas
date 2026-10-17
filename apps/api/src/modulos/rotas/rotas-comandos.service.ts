import { Injectable } from '@nestjs/common';
import {
  STATUS_PARADA_TERMINAIS,
  type CancelarEntrada,
  type ComandoComVersao,
  type Rota,
  type TransferirRotaEntrada,
} from '@rotas/shared';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { validarEnvio } from './dominio/edicao.js';
import { rotaDeveConcluir, transicaoParada, transicaoRota, type ComandoRota } from './dominio/transicoes.js';
import { garantirMotoristaAtivo, obterRota, registrarEvento, travarRota, type Tx } from './rotas.apoio.js';
import { mapearRota, type RotaRegistro } from './rotas.mapper.js';

const PARADA_ATIVA = ['A_CAMINHO', 'NO_LOCAL'] as const;

function exigirTransicao(rota: RotaRegistro, comando: ComandoRota) {
  const resultado = transicaoRota(rota.status, comando, 'ADMIN');
  if (!resultado.ok) throw ErroDominio.transicaoInvalida(resultado.motivo);
  // Comandos do admin aqui nunca levam a exclusão (null).
  return resultado.valor ?? rota.status;
}

@Injectable()
export class RotasComandosService {
  constructor(private readonly prisma: PrismaService) {}

  async enviar(id: string, dados: ComandoComVersao, usuario: UsuarioAutenticado): Promise<Rota> {
    return this.prisma.$transaction(async (tx) => {
      const rota = await travarRota(tx, id, dados.versao);
      const destino = exigirTransicao(rota, 'ENVIAR');

      const arquivadas = await tx.empresa.findMany({
        where: { id: { in: rota.paradas.map((p) => p.empresaId) }, arquivadaEm: { not: null } },
        select: { id: true },
      });
      const idsArquivadas = new Set(arquivadas.map((e) => e.id));
      const validacao = validarEnvio({
        motoristaAtivo: rota.motorista ? rota.motorista.desativadoEm === null && rota.motorista.usuario.ativo : null,
        paradas: rota.paradas.map((p) => ({
          nomeEmpresa: p.nomeEmpresa,
          quantidadeServicos: p.servicos.length,
          empresaArquivada: idsArquivadas.has(p.empresaId),
        })),
      });
      if (!validacao.ok) throw ErroDominio.regraNegocio(validacao.motivo);

      await tx.rota.update({ where: { id }, data: { status: destino, enviadaEm: new Date() } });
      await registrarEvento(tx, {
        rotaId: id,
        tipo: 'ROTA_ENVIADA',
        statusAnterior: rota.status,
        statusNovo: destino,
        autorUsuarioId: usuario.usuarioId,
        dados: { motoristaId: rota.motorista!.id, paradas: rota.paradas.length },
      });
      return mapearRota(await obterRota(tx, id));
    });
  }

  /** Paradas não terminais viram CANCELADA e serviços pendentes viram CANCELADO; o já executado fica. */
  async cancelar(id: string, dados: CancelarEntrada, usuario: UsuarioAutenticado): Promise<Rota> {
    return this.prisma.$transaction(async (tx) => {
      const rota = await travarRota(tx, id, dados.versao);
      const destino = exigirTransicao(rota, 'CANCELAR');
      const abertas = rota.paradas.filter((p) => !STATUS_PARADA_TERMINAIS.includes(p.status)).map((p) => p.id);

      await this.cancelarParadas(tx, abertas);
      await tx.rota.update({
        where: { id },
        data: { status: destino, canceladaEm: new Date(), motivoCancelamento: dados.motivo },
      });
      await registrarEvento(tx, {
        rotaId: id,
        tipo: 'ROTA_CANCELADA',
        statusAnterior: rota.status,
        statusNovo: destino,
        autorUsuarioId: usuario.usuarioId,
        dados: { motivo: dados.motivo, paradasCanceladas: abertas.length },
      });
      return mapearRota(await obterRota(tx, id));
    });
  }

  /**
   * A rota volta para ENVIADA com o novo motorista, que confirma e inicia. Serviços já executados mantêm
   * `executadoPorMotoristaId`; a parada ativa do motorista anterior volta para PENDENTE.
   */
  async transferir(id: string, dados: TransferirRotaEntrada, usuario: UsuarioAutenticado): Promise<Rota> {
    return this.prisma.$transaction(async (tx) => {
      const rota = await travarRota(tx, id, dados.versao);
      const destino = exigirTransicao(rota, 'TRANSFERIR');
      const anterior = rota.motorista?.id ?? null;
      if (anterior === dados.motoristaId) {
        throw ErroDominio.regraNegocio('Escolha um motorista diferente do atual.');
      }
      await garantirMotoristaAtivo(tx, dados.motoristaId);

      const devolvidas = await tx.parada.updateMany({
        where: { rotaId: id, status: { in: [...PARADA_ATIVA] } },
        data: { status: 'PENDENTE', chegadaEm: null },
      });
      await tx.rota.update({
        where: { id },
        data: { motoristaId: dados.motoristaId, status: destino, recebidaEm: null },
      });
      await registrarEvento(tx, {
        rotaId: id,
        tipo: 'ROTA_TRANSFERIDA',
        statusAnterior: rota.status,
        statusNovo: destino,
        autorUsuarioId: usuario.usuarioId,
        dados: {
          deMotoristaId: anterior,
          paraMotoristaId: dados.motoristaId,
          motivo: dados.motivo,
          paradasDevolvidas: devolvidas.count,
        },
      });
      return mapearRota(await obterRota(tx, id));
    });
  }

  /** CANCELAR_PARADA (rota em andamento). Se era a última parada aberta, a rota conclui na mesma transação. */
  async cancelarParada(
    id: string,
    paradaId: string,
    dados: CancelarEntrada,
    usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.prisma.$transaction(async (tx) => {
      const rota = await travarRota(tx, id, dados.versao);
      const parada = rota.paradas.find((p) => p.id === paradaId);
      if (!parada) throw ErroDominio.naoEncontrado('Parada não encontrada nesta rota.');

      const resultado = transicaoParada(parada.status, 'CANCELAR_PARADA', 'ADMIN', rota.status);
      if (!resultado.ok) throw ErroDominio.transicaoInvalida(resultado.motivo);

      await this.cancelarParadas(tx, [paradaId]);
      await registrarEvento(tx, {
        rotaId: id,
        tipo: 'PARADA_CANCELADA',
        statusAnterior: parada.status,
        statusNovo: resultado.valor,
        autorUsuarioId: usuario.usuarioId,
        dados: { paradaId, motivo: dados.motivo },
      });

      const statusDepois = rota.paradas.map((p) => (p.id === paradaId ? resultado.valor : p.status));
      if (rotaDeveConcluir(statusDepois)) {
        const conclusao = transicaoRota(rota.status, 'CONCLUIR', 'SISTEMA');
        if (conclusao.ok && conclusao.valor) {
          await tx.rota.update({ where: { id }, data: { status: conclusao.valor, concluidaEm: new Date() } });
          await registrarEvento(tx, {
            rotaId: id,
            tipo: 'ROTA_CONCLUIDA',
            statusAnterior: rota.status,
            statusNovo: conclusao.valor,
            autorUsuarioId: null,
          });
        }
      }
      return mapearRota(await obterRota(tx, id));
    });
  }

  private async cancelarParadas(tx: Tx, paradaIds: readonly string[]): Promise<void> {
    if (paradaIds.length === 0) return;
    await tx.servico.updateMany({
      where: { paradaId: { in: [...paradaIds] }, status: 'PENDENTE' },
      data: { status: 'CANCELADO' },
    });
    await tx.parada.updateMany({ where: { id: { in: [...paradaIds] } }, data: { status: 'CANCELADA' } });
  }
}

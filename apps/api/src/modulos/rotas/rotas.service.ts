import { Injectable } from '@nestjs/common';
import {
  type CriarRotaEntrada,
  type DuplicarRotaEntrada,
  type EventoRota,
  type FiltroRotas,
  type RespostaPaginada,
  type Rota,
  type RotaDuplicada,
  type RotaResumo,
} from '@rotas/shared';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { transicaoRota } from './dominio/transicoes.js';
import {
  carregarEmpresasParaParadas,
  contarParadas,
  dadosParadaNova,
  garantirMotoristaAtivo,
  obterRota,
  registrarEvento,
  travarRota,
} from './rotas.apoio.js';
import {
  eventoSelect,
  mapearEvento,
  mapearRota,
  mapearRotaResumo,
  paraData,
  rotaResumoSelect,
} from './rotas.mapper.js';

const LIMITE_EVENTOS = 1000;

@Injectable()
export class RotasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtro: FiltroRotas): Promise<RespostaPaginada<RotaResumo>> {
    const where: Prisma.RotaWhereInput = {
      ...(filtro.busca ? { nome: { contains: filtro.busca, mode: 'insensitive' } } : {}),
      ...(filtro.status ? { status: { in: filtro.status } } : {}),
      ...(filtro.motoristaId ? { motoristaId: filtro.motoristaId } : {}),
      ...(filtro.dataDe || filtro.dataAte
        ? {
            dataPrevista: {
              ...(filtro.dataDe ? { gte: paraData(filtro.dataDe) } : {}),
              ...(filtro.dataAte ? { lte: paraData(filtro.dataAte) } : {}),
            },
          }
        : {}),
    };

    const [registros, total] = await Promise.all([
      this.prisma.rota.findMany({
        where,
        select: rotaResumoSelect,
        orderBy: [{ dataPrevista: 'desc' }, { criadoEm: 'desc' }, { id: 'asc' }],
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
      }),
      this.prisma.rota.count({ where }),
    ]);

    const contagens = await contarParadas(
      this.prisma,
      registros.map((r) => r.id),
    );

    return {
      itens: registros.map((r) => mapearRotaResumo(r, contagens.get(r.id) ?? { total: 0, concluidas: 0 })),
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  }

  async buscarPorId(id: string): Promise<Rota> {
    return mapearRota(await obterRota(this.prisma, id));
  }

  async criar(dados: CriarRotaEntrada, usuario: UsuarioAutenticado): Promise<Rota> {
    return this.prisma.$transaction(async (tx) => {
      if (dados.motoristaId) await garantirMotoristaAtivo(tx, dados.motoristaId);
      const empresas = await carregarEmpresasParaParadas(
        tx,
        dados.paradas.map((p) => p.empresaId),
      );

      const { id } = await tx.rota.create({
        data: {
          nome: dados.nome,
          dataPrevista: paraData(dados.dataPrevista),
          motoristaId: dados.motoristaId ?? null,
          criadoPorId: usuario.usuarioId,
        },
        select: { id: true },
      });

      for (const [indice, parada] of dados.paradas.entries()) {
        await tx.parada.create({
          data: dadosParadaNova(id, indice + 1, empresas.get(parada.empresaId)!, parada.servicos, parada.observacoes ?? null),
          select: { id: true },
        });
      }

      await registrarEvento(tx, {
        rotaId: id,
        tipo: 'ROTA_CRIADA',
        statusNovo: 'RASCUNHO',
        autorUsuarioId: usuario.usuarioId,
        dados: { paradas: dados.paradas.length },
      });
      return mapearRota(await obterRota(tx, id));
    });
  }

  /** Única exclusão física do domínio: rota em RASCUNHO. */
  async excluir(id: string, versao: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rota = await travarRota(tx, id, versao);
      const resultado = transicaoRota(rota.status, 'EXCLUIR', 'ADMIN');
      if (!resultado.ok) throw ErroDominio.transicaoInvalida(resultado.motivo);
      await tx.rota.delete({ where: { id } });
    });
  }

  /**
   * Nova rota em RASCUNHO com as mesmas empresas, ordem, serviços e observações, sem motorista e sem horários.
   * O snapshot vem do cadastro atual; empresas arquivadas ficam de fora e são devolvidas para o admin.
   */
  async duplicar(id: string, dados: DuplicarRotaEntrada, usuario: UsuarioAutenticado): Promise<RotaDuplicada> {
    return this.prisma.$transaction(async (tx) => {
      const origem = await obterRota(tx, id);
      const empresas = await tx.empresa.findMany({
        where: { id: { in: [...new Set(origem.paradas.map((p) => p.empresaId))] } },
        select: { id: true, arquivadaEm: true },
      });
      const arquivadas = new Set(empresas.filter((e) => e.arquivadaEm !== null).map((e) => e.id));
      const copiadas = origem.paradas.filter((p) => !arquivadas.has(p.empresaId));
      const snapshots = await carregarEmpresasParaParadas(
        tx,
        copiadas.map((p) => p.empresaId),
      );

      const { id: novaId } = await tx.rota.create({
        data: {
          nome: dados.nome ?? `${origem.nome} (cópia)`.slice(0, 120),
          dataPrevista: dados.dataPrevista ? paraData(dados.dataPrevista) : origem.dataPrevista,
          criadoPorId: usuario.usuarioId,
          rotaOrigemId: origem.id,
        },
        select: { id: true },
      });

      for (const [indice, parada] of copiadas.entries()) {
        await tx.parada.create({
          data: dadosParadaNova(
            novaId,
            indice + 1,
            snapshots.get(parada.empresaId)!,
            parada.servicos.map((s) => s.tipo),
            parada.observacoes,
          ),
          select: { id: true },
        });
      }

      await registrarEvento(tx, {
        rotaId: novaId,
        tipo: 'ROTA_CRIADA',
        statusNovo: 'RASCUNHO',
        autorUsuarioId: usuario.usuarioId,
        dados: { paradas: copiadas.length, duplicadaDe: origem.id },
      });

      const omitidas = origem.paradas
        .filter((p) => arquivadas.has(p.empresaId))
        .map((p) => ({ empresaId: p.empresaId, nomeEmpresa: p.nomeEmpresa }));
      return { rota: mapearRota(await obterRota(tx, novaId)), empresasOmitidas: omitidas };
    });
  }

  async historico(id: string): Promise<EventoRota[]> {
    await obterRota(this.prisma, id);
    const eventos = await this.prisma.rotaEvento.findMany({
      where: { rotaId: id },
      select: eventoSelect,
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
      take: LIMITE_EVENTOS,
    });
    return eventos.map(mapearEvento);
  }
}

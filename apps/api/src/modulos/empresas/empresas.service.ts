import { Injectable } from '@nestjs/common';
import type {
  AtualizarEmpresaEntrada,
  CriarEmpresaEntrada,
  Empresa,
  FiltroEmpresas,
  RespostaPaginada,
} from '@rotas/shared';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { empresaSelect, mapearEmpresa } from './empresas.mapper.js';

@Injectable()
export class EmpresasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtro: FiltroEmpresas): Promise<RespostaPaginada<Empresa>> {
    const where: Prisma.EmpresaWhereInput = {
      ...(filtro.incluirArquivadas ? {} : { arquivadaEm: null }),
      ...(filtro.busca
        ? {
            OR: [
              { nomeFantasia: { contains: filtro.busca, mode: 'insensitive' } },
              { bairro: { contains: filtro.busca, mode: 'insensitive' } },
              { cidade: { contains: filtro.busca, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (filtro.pagina - 1) * filtro.porPagina;
    const [registros, total] = await Promise.all([
      this.prisma.empresa.findMany({
        where,
        select: empresaSelect,
        orderBy: [{ nomeFantasia: 'asc' }, { id: 'asc' }],
        skip,
        take: filtro.porPagina,
      }),
      this.prisma.empresa.count({ where }),
    ]);

    return {
      itens: registros.map(mapearEmpresa),
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  }

  async buscarPorId(id: string): Promise<Empresa> {
    const registro = await this.prisma.empresa.findUnique({
      where: { id },
      select: empresaSelect,
    });
    if (!registro) {
      throw ErroDominio.naoEncontrado('Empresa não encontrada.');
    }
    return mapearEmpresa(registro);
  }

  async criar(dados: CriarEmpresaEntrada): Promise<Empresa> {
    const temCoordenadas = dados.latitude !== undefined && dados.longitude !== undefined;
    const registro = await this.prisma.empresa.create({
      data: {
        nomeFantasia: dados.nomeFantasia,
        razaoSocial: dados.razaoSocial ?? null,
        documento: dados.documento ?? null,
        telefone: dados.telefone,
        whatsapp: dados.whatsapp ?? null,
        logradouro: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento ?? null,
        bairro: dados.bairro,
        cidade: dados.cidade,
        uf: dados.uf,
        cep: dados.cep,
        latitude: dados.latitude ?? null,
        longitude: dados.longitude ?? null,
        fonteLocalizacao: temCoordenadas ? 'MANUAL' : null,
        precisaoLocalizacao: temCoordenadas ? 'EXATA' : null,
        localizacaoAtualizadaEm: temCoordenadas ? new Date() : null,
        responsavel: dados.responsavel ?? null,
        horarioFuncionamento: dados.horarioFuncionamento ?? null,
        observacoes: dados.observacoes ?? null,
      },
      select: empresaSelect,
    });
    return mapearEmpresa(registro);
  }

  async atualizar(id: string, dados: AtualizarEmpresaEntrada): Promise<Empresa> {
    const dadosLocalizacao: Prisma.EmpresaUpdateManyMutationInput =
      typeof dados.latitude === 'number' && typeof dados.longitude === 'number'
        ? {
            latitude: dados.latitude,
            longitude: dados.longitude,
            fonteLocalizacao: 'MANUAL',
            precisaoLocalizacao: 'EXATA',
            localizacaoAtualizadaEm: new Date(),
          }
        : dados.latitude === null && dados.longitude === null
          ? {
              latitude: null,
              longitude: null,
              fonteLocalizacao: null,
              precisaoLocalizacao: null,
              localizacaoAtualizadaEm: null,
            }
          : {};

    return this.prisma.$transaction(async (tx) => {
      const resultado = await tx.empresa.updateMany({
        where: { id, arquivadaEm: null },
        data: {
          nomeFantasia: dados.nomeFantasia,
          razaoSocial: dados.razaoSocial,
          documento: dados.documento,
          telefone: dados.telefone,
          whatsapp: dados.whatsapp,
          logradouro: dados.logradouro,
          numero: dados.numero,
          complemento: dados.complemento,
          bairro: dados.bairro,
          cidade: dados.cidade,
          uf: dados.uf,
          cep: dados.cep,
          responsavel: dados.responsavel,
          horarioFuncionamento: dados.horarioFuncionamento,
          observacoes: dados.observacoes,
          ...dadosLocalizacao,
        },
      });

      if (resultado.count === 0) {
        const existente = await tx.empresa.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!existente) {
          throw ErroDominio.naoEncontrado('Empresa não encontrada.');
        }
        throw ErroDominio.regraNegocio('Empresa arquivada não pode ser editada.');
      }

      const registro = await tx.empresa.findUniqueOrThrow({
        where: { id },
        select: empresaSelect,
      });
      return mapearEmpresa(registro);
    });
  }

  async arquivar(id: string): Promise<Empresa> {
    const atual = await this.prisma.empresa.findUnique({
      where: { id },
      select: empresaSelect,
    });
    if (!atual) {
      throw ErroDominio.naoEncontrado('Empresa não encontrada.');
    }
    if (atual.arquivadaEm !== null) {
      return mapearEmpresa(atual);
    }

    const registro = await this.prisma.empresa.update({
      where: { id },
      data: { arquivadaEm: new Date() },
      select: empresaSelect,
    });
    return mapearEmpresa(registro);
  }

  async reativar(id: string): Promise<Empresa> {
    const atual = await this.prisma.empresa.findUnique({
      where: { id },
      select: empresaSelect,
    });
    if (!atual) {
      throw ErroDominio.naoEncontrado('Empresa não encontrada.');
    }
    if (atual.arquivadaEm === null) {
      return mapearEmpresa(atual);
    }

    const registro = await this.prisma.empresa.update({
      where: { id },
      data: { arquivadaEm: null },
      select: empresaSelect,
    });
    return mapearEmpresa(registro);
  }
}

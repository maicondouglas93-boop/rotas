import { Injectable } from '@nestjs/common';
import type {
  AtualizarMotoristaEntrada,
  CriarMotoristaEntrada,
  FiltroMotoristas,
  Motorista,
  MotoristaCriado,
  RespostaPaginada,
  SenhaRedefinida,
} from '@rotas/shared';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SenhasService } from '../auth/senhas.service.js';
import { mapearMotorista, motoristaSelect } from './motoristas.mapper.js';
import { gerarSenhaTemporaria } from './senha-temporaria.js';

type Tx = Prisma.TransactionClient;

const MENSAGEM_NAO_ENCONTRADO = 'Motorista não encontrado.';
const MENSAGEM_EMAIL_EM_USO = 'Já existe um usuário com este e-mail.';
const MENSAGEM_DESATIVADO = 'Motorista desativado não pode ser alterado. Reative-o antes.';

@Injectable()
export class MotoristasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly senhas: SenhasService,
  ) {}

  async listar(filtro: FiltroMotoristas): Promise<RespostaPaginada<Motorista>> {
    const where: Prisma.MotoristaWhereInput = {
      ...(filtro.incluirDesativados ? {} : { desativadoEm: null }),
      ...(filtro.busca
        ? {
            OR: [
              { nome: { contains: filtro.busca, mode: 'insensitive' } },
              { usuario: { email: { contains: filtro.busca, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [registros, total] = await Promise.all([
      this.prisma.motorista.findMany({
        where,
        select: motoristaSelect,
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
      }),
      this.prisma.motorista.count({ where }),
    ]);

    return { itens: registros.map(mapearMotorista), total, pagina: filtro.pagina, porPagina: filtro.porPagina };
  }

  async buscarPorId(id: string): Promise<Motorista> {
    return mapearMotorista(await this.obter(this.prisma, id));
  }

  /** Cria a conta (perfil MOTORISTA) com senha temporária, que precisa ser trocada no primeiro acesso. */
  async criar(dados: CriarMotoristaEntrada): Promise<MotoristaCriado> {
    await this.garantirEmailLivre(this.prisma, dados.email);

    const senhaTemporaria = gerarSenhaTemporaria();
    const senhaHash = await this.senhas.gerarHash(senhaTemporaria);

    const usuario = await this.prisma.usuario.create({
      data: {
        email: dados.email,
        senhaHash,
        perfil: 'MOTORISTA',
        ativo: true,
        deveTrocarSenha: true,
        motorista: { create: { nome: dados.nome, telefone: dados.telefone } },
      },
      select: { motorista: { select: motoristaSelect } },
    });

    // O create aninhado sempre cria o motorista; a checagem só satisfaz o tipo.
    if (!usuario.motorista) throw new Error('Motorista não foi criado junto com o usuário.');
    return { motorista: mapearMotorista(usuario.motorista), senhaTemporaria };
  }

  async atualizar(id: string, dados: AtualizarMotoristaEntrada): Promise<Motorista> {
    return this.prisma.$transaction(async (tx) => {
      // Atualização condicional: trava a linha e falha se o motorista foi desativado nesse meio-tempo.
      const resultado = await tx.motorista.updateMany({
        where: { id, desativadoEm: null },
        data: { nome: dados.nome, telefone: dados.telefone, atualizadoEm: new Date() },
      });
      if (resultado.count === 0) {
        await this.obter(tx, id);
        throw ErroDominio.regraNegocio(MENSAGEM_DESATIVADO);
      }

      const atual = await this.obter(tx, id);
      if (dados.email !== undefined && dados.email !== atual.usuario.email) {
        await this.garantirEmailLivre(tx, dados.email, atual.usuarioId);
        await tx.usuario.update({ where: { id: atual.usuarioId }, data: { email: dados.email } });
      }

      return mapearMotorista(await this.obter(tx, id));
    });
  }

  /**
   * Bloqueia o acesso na hora: marca o motorista, desativa o usuário e revoga todas as sessões.
   * Rotas não terminais continuam com ele até o admin transferir ou cancelar (delivery-domain-rules).
   */
  async desativar(id: string): Promise<Motorista> {
    return this.prisma.$transaction(async (tx) => {
      const agora = new Date();
      const resultado = await tx.motorista.updateMany({
        where: { id, desativadoEm: null },
        data: { desativadoEm: agora },
      });
      const atual = await this.obter(tx, id);
      if (resultado.count === 0) return mapearMotorista(atual);

      await tx.usuario.update({ where: { id: atual.usuarioId }, data: { ativo: false } });
      await this.revogarSessoes(tx, atual.usuarioId, agora);
      return mapearMotorista(await this.obter(tx, id));
    });
  }

  async reativar(id: string): Promise<Motorista> {
    return this.prisma.$transaction(async (tx) => {
      const resultado = await tx.motorista.updateMany({
        where: { id, desativadoEm: { not: null } },
        data: { desativadoEm: null },
      });
      const atual = await this.obter(tx, id);
      if (resultado.count === 0) return mapearMotorista(atual);

      await tx.usuario.update({ where: { id: atual.usuarioId }, data: { ativo: true } });
      return mapearMotorista(await this.obter(tx, id));
    });
  }

  /** Gera nova senha temporária, exige troca no próximo acesso e encerra as sessões abertas. */
  async redefinirSenha(id: string): Promise<SenhaRedefinida> {
    const senhaTemporaria = gerarSenhaTemporaria();
    const senhaHash = await this.senhas.gerarHash(senhaTemporaria);

    await this.prisma.$transaction(async (tx) => {
      const atual = await this.obter(tx, id);
      if (atual.desativadoEm !== null) throw ErroDominio.regraNegocio(MENSAGEM_DESATIVADO);

      // Condicional ao usuário seguir ativo: evita redefinir a senha de quem foi desativado agora.
      const resultado = await tx.usuario.updateMany({
        where: { id: atual.usuarioId, ativo: true },
        data: { senhaHash, deveTrocarSenha: true },
      });
      if (resultado.count === 0) throw ErroDominio.regraNegocio(MENSAGEM_DESATIVADO);

      await this.revogarSessoes(tx, atual.usuarioId, new Date());
    });

    return { senhaTemporaria };
  }

  private async obter(db: Tx | PrismaService, id: string) {
    const registro = await db.motorista.findUnique({ where: { id }, select: motoristaSelect });
    if (!registro) throw ErroDominio.naoEncontrado(MENSAGEM_NAO_ENCONTRADO);
    return registro;
  }

  /** Mensagem clara para o caso comum; a unicidade no banco (P2002 → 409) cobre a corrida. */
  private async garantirEmailLivre(db: Tx | PrismaService, email: string, exceto?: string): Promise<void> {
    const existente = await db.usuario.findUnique({ where: { email }, select: { id: true } });
    if (existente && existente.id !== exceto) throw ErroDominio.registroDuplicado(MENSAGEM_EMAIL_EM_USO);
  }

  private async revogarSessoes(tx: Tx, usuarioId: string, agora: Date): Promise<void> {
    await tx.sessaoRefresh.updateMany({ where: { usuarioId, revogadaEm: null }, data: { revogadaEm: agora } });
  }
}

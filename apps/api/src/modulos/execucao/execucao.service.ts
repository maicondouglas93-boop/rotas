import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type ComandoMotorista,
  type FiltroRotasMotorista,
  type NaoRealizarServicoEntrada,
  type RealizarServicoEntrada,
  type RegistrarOcorrenciaEntrada,
  type RespostaPaginada,
  type Rota,
  type RotaResumo,
} from '@rotas/shared';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import { IdempotenciaService } from '../../comum/idempotencia/idempotencia.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ARMAZENAMENTO, chaveComprovante, type ArmazenamentoArquivos } from '../armazenamento/armazenamento.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import {
  paradaDeveFinalizar,
  rotaDeveConcluir,
  transicaoParada,
  transicaoRota,
  transicaoServico,
} from '../rotas/dominio/transicoes.js';
import { contarParadas, obterRota, registrarEvento, travarRotaSemVersao, type Tx } from '../rotas/rotas.apoio.js';
import { mapearRota, mapearRotaResumo, rotaResumoSelect, rotaSelect, type RotaRegistro } from '../rotas/rotas.mapper.js';

type ParadaRegistro = RotaRegistro['paradas'][number];
type ServicoRegistro = ParadaRegistro['servicos'][number];

const ATOR = 'MOTORISTA_DA_ROTA' as const;
const NAO_ENCONTRADA = 'Rota não encontrada.';

interface Contexto {
  usuario: UsuarioAutenticado;
  motoristaId: string;
  ocorridoEm: Date | null;
}

function contexto(usuario: UsuarioAutenticado, dados: ComandoMotorista): Contexto {
  if (!usuario.motoristaId) throw ErroDominio.semPermissao();
  return { usuario, motoristaId: usuario.motoristaId, ocorridoEm: dados.ocorridoEm ? new Date(dados.ocorridoEm) : null };
}

/**
 * Consultas e comandos do motorista sobre as próprias rotas (delivery-domain-rules).
 * Cada comando: confere o dono, trava a linha da rota, relê o estado e só então aplica a transição.
 * Se o destino já foi atingido (reenvio com outra chave), devolve o estado atual sem novo evento.
 */
@Injectable()
export class ExecucaoService {
  private readonly logger = new Logger(ExecucaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotencia: IdempotenciaService,
    @Inject(ARMAZENAMENTO) private readonly armazenamento: ArmazenamentoArquivos,
  ) {}

  async listar(usuario: UsuarioAutenticado, filtro: FiltroRotasMotorista): Promise<RespostaPaginada<RotaResumo>> {
    if (!usuario.motoristaId) throw ErroDominio.semPermissao();
    const where = { motoristaId: usuario.motoristaId, status: { in: filtro.status } };
    const [registros, total] = await Promise.all([
      this.prisma.rota.findMany({
        where,
        select: rotaResumoSelect,
        orderBy: [{ dataPrevista: 'asc' }, { criadoEm: 'asc' }, { id: 'asc' }],
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

  async buscar(usuario: UsuarioAutenticado, rotaId: string): Promise<Rota> {
    if (!usuario.motoristaId) throw ErroDominio.semPermissao();
    const rota = await this.prisma.rota.findFirst({
      where: { id: rotaId, motoristaId: usuario.motoristaId, status: { not: 'RASCUNHO' } },
      select: rotaSelect,
    });
    if (!rota) throw ErroDominio.naoEncontrado(NAO_ENCONTRADA);
    return mapearRota(rota);
  }

  confirmarRecebimento(usuario: UsuarioAutenticado, rotaId: string, dados: ComandoMotorista, chave: string) {
    const ctx = contexto(usuario, dados);
    return this.idempotencia.executar(usuario.usuarioId, chave, `confirmar:${rotaId}`, async (tx) => {
      const rota = await this.rotaDoMotorista(tx, ctx, rotaId);
      if (rota.status === 'RECEBIDA') return mapearRota(rota);
      const destino = this.exigir(transicaoRota(rota.status, 'CONFIRMAR_RECEBIMENTO', ATOR));

      await tx.rota.update({ where: { id: rotaId }, data: { status: destino, recebidaEm: new Date() } });
      await this.evento(tx, ctx, rotaId, 'ROTA_RECEBIDA', rota.status, destino);
      return mapearRota(await obterRota(tx, rotaId));
    });
  }

  iniciar(usuario: UsuarioAutenticado, rotaId: string, dados: ComandoMotorista, chave: string) {
    const ctx = contexto(usuario, dados);
    return this.idempotencia.executar(usuario.usuarioId, chave, `iniciar:${rotaId}`, async (tx) => {
      const rota = await this.rotaDoMotorista(tx, ctx, rotaId);
      if (rota.status === 'EM_ANDAMENTO') return mapearRota(rota);
      const destino = this.exigir(transicaoRota(rota.status, 'INICIAR', ATOR));

      const outraEmAndamento = await tx.rota.count({
        where: { motoristaId: ctx.motoristaId, status: 'EM_ANDAMENTO', id: { not: rotaId } },
      });
      if (outraEmAndamento > 0) throw ErroDominio.transicaoInvalida('Conclua a rota em andamento antes de iniciar outra.');

      // Depois de uma transferência a rota pode já ter início registrado: o primeiro início vale para o relatório.
      await tx.rota.update({
        where: { id: rotaId },
        data: { status: destino, iniciadaEm: rota.iniciadaEm ?? new Date() },
      });
      await this.evento(tx, ctx, rotaId, 'ROTA_INICIADA', rota.status, destino);
      return mapearRota(await obterRota(tx, rotaId));
    });
  }

  seguirPara(usuario: UsuarioAutenticado, paradaId: string, dados: ComandoMotorista, chave: string) {
    const ctx = contexto(usuario, dados);
    return this.idempotencia.executar(usuario.usuarioId, chave, `seguir:${paradaId}`, async (tx) => {
      const { rota, parada } = await this.paradaDoMotorista(tx, ctx, paradaId);
      if (parada.status === 'A_CAMINHO') return mapearRota(rota);
      const destino = this.exigir(transicaoParada(parada.status, 'SEGUIR_PARA', ATOR, rota.status));

      const outras = rota.paradas.filter((p) => p.id !== paradaId);
      if (outras.some((p) => p.status === 'NO_LOCAL')) {
        throw ErroDominio.transicaoInvalida('Finalize a parada em que você está antes de seguir para outra.');
      }
      // No máximo uma parada ativa por rota: a que estava a caminho volta para a fila.
      for (const anterior of outras.filter((p) => p.status === 'A_CAMINHO')) {
        await tx.parada.update({ where: { id: anterior.id }, data: { status: 'PENDENTE' } });
        await this.evento(tx, ctx, rota.id, 'PARADA_RETORNOU_FILA', 'A_CAMINHO', 'PENDENTE', { paradaId: anterior.id });
      }

      await tx.parada.update({ where: { id: paradaId }, data: { status: destino } });
      await this.evento(tx, ctx, rota.id, 'PARADA_A_CAMINHO', parada.status, destino, { paradaId });
      return mapearRota(await obterRota(tx, rota.id));
    });
  }

  voltarParaFila(usuario: UsuarioAutenticado, paradaId: string, dados: ComandoMotorista, chave: string) {
    const ctx = contexto(usuario, dados);
    return this.idempotencia.executar(usuario.usuarioId, chave, `voltar:${paradaId}`, async (tx) => {
      const { rota, parada } = await this.paradaDoMotorista(tx, ctx, paradaId);
      if (parada.status === 'PENDENTE') return mapearRota(rota);
      const destino = this.exigir(transicaoParada(parada.status, 'VOLTAR_PARA_FILA', ATOR, rota.status));

      await tx.parada.update({ where: { id: paradaId }, data: { status: destino } });
      await this.evento(tx, ctx, rota.id, 'PARADA_RETORNOU_FILA', parada.status, destino, { paradaId });
      return mapearRota(await obterRota(tx, rota.id));
    });
  }

  registrarChegada(usuario: UsuarioAutenticado, paradaId: string, dados: ComandoMotorista, chave: string) {
    const ctx = contexto(usuario, dados);
    return this.idempotencia.executar(usuario.usuarioId, chave, `cheguei:${paradaId}`, async (tx) => {
      const { rota, parada } = await this.paradaDoMotorista(tx, ctx, paradaId);
      if (parada.status === 'NO_LOCAL') return mapearRota(rota);
      const destino = this.exigir(transicaoParada(parada.status, 'CHEGAR', ATOR, rota.status));
      if (rota.paradas.some((p) => p.id !== paradaId && p.status === 'NO_LOCAL')) {
        throw ErroDominio.transicaoInvalida('Finalize a parada em que você está antes de registrar outra chegada.');
      }

      await tx.parada.update({ where: { id: paradaId }, data: { status: destino, chegadaEm: new Date() } });
      await this.evento(tx, ctx, rota.id, 'PARADA_CHEGADA', parada.status, destino, { paradaId });
      return mapearRota(await obterRota(tx, rota.id));
    });
  }

  async realizarServico(usuario: UsuarioAutenticado, servicoId: string, dados: RealizarServicoEntrada, chave: string) {
    const ctx = contexto(usuario, dados);
    const comprovante = dados.comprovante;
    // A foto vai para o armazenamento antes da transação (sem E/S externa dentro dela) e é apagada
    // se o comando não chegar a usá-la (repetição, transição recusada ou erro).
    const foto = comprovante?.fotoJpegBase64 ? Buffer.from(comprovante.fotoJpegBase64, 'base64') : null;
    const fotoChave = foto ? await this.salvarFoto(ctx, servicoId, foto) : null;
    let fotoUsada = false;

    try {
      return await this.idempotencia.executar(usuario.usuarioId, chave, `realizar:${servicoId}`, async (tx) => {
        const { rota, parada, servico } = await this.servicoDoMotorista(tx, ctx, servicoId);
        if (servico.status === 'REALIZADO') return mapearRota(rota);
        const destino = this.exigir(transicaoServico(servico.status, 'REALIZAR', ATOR, parada.status));

        await tx.servico.update({
          where: { id: servicoId },
          data: { status: destino, executadoPorMotoristaId: ctx.motoristaId, concluidoEm: new Date() },
        });
        if (comprovante) {
          await tx.comprovante.create({
            data: {
              servicoId,
              motoristaId: ctx.motoristaId,
              nomeRecebedor: comprovante.nomeRecebedor ?? null,
              ...(comprovante.assinatura ? { assinatura: comprovante.assinatura as Prisma.InputJsonValue } : {}),
              fotoChave,
              fotoBytes: foto?.length ?? null,
            },
          });
          fotoUsada = fotoChave !== null;
        }
        await this.evento(tx, ctx, rota.id, 'SERVICO_REALIZADO', servico.status, destino, {
          paradaId: parada.id,
          servicoId,
          tipo: servico.tipo,
          comprovante: comprovante !== undefined,
        });
        await this.concluirSePreciso(tx, ctx, rota.id, parada.id);
        return mapearRota(await obterRota(tx, rota.id));
      });
    } finally {
      if (fotoChave && !fotoUsada) await this.apagarFoto(fotoChave);
    }
  }

  naoRealizarServico(usuario: UsuarioAutenticado, servicoId: string, dados: NaoRealizarServicoEntrada, chave: string) {
    const ctx = contexto(usuario, dados);
    return this.idempotencia.executar(usuario.usuarioId, chave, `nao-realizar:${servicoId}`, async (tx) => {
      const { rota, parada, servico } = await this.servicoDoMotorista(tx, ctx, servicoId);
      if (servico.status === 'NAO_REALIZADO') return mapearRota(rota);
      const destino = this.exigir(transicaoServico(servico.status, 'NAO_REALIZAR', ATOR, parada.status));

      const ocorrencia = await tx.ocorrencia.create({
        data: {
          paradaId: parada.id,
          servicoId,
          motoristaId: ctx.motoristaId,
          tipo: dados.tipoOcorrencia,
          descricao: dados.descricao ?? null,
          ocorridaEm: ctx.ocorridoEm ?? new Date(),
        },
        select: { id: true },
      });
      await tx.servico.update({
        where: { id: servicoId },
        data: { status: destino, executadoPorMotoristaId: ctx.motoristaId, concluidoEm: new Date() },
      });
      await this.evento(tx, ctx, rota.id, 'OCORRENCIA_REGISTRADA', null, null, {
        paradaId: parada.id,
        servicoId,
        ocorrenciaId: ocorrencia.id,
        tipo: dados.tipoOcorrencia,
      });
      await this.evento(tx, ctx, rota.id, 'SERVICO_NAO_REALIZADO', servico.status, destino, {
        paradaId: parada.id,
        servicoId,
        tipo: servico.tipo,
        ocorrenciaId: ocorrencia.id,
      });
      await this.concluirSePreciso(tx, ctx, rota.id, parada.id);
      return mapearRota(await obterRota(tx, rota.id));
    });
  }

  /** Ocorrência informativa na parada atual; não encerra serviço. */
  registrarOcorrencia(
    usuario: UsuarioAutenticado,
    paradaId: string,
    dados: RegistrarOcorrenciaEntrada,
    chave: string,
  ) {
    const ctx = contexto(usuario, dados);
    return this.idempotencia.executar(usuario.usuarioId, chave, `ocorrencia:${paradaId}`, async (tx) => {
      const { rota, parada } = await this.paradaDoMotorista(tx, ctx, paradaId);
      if (rota.status !== 'EM_ANDAMENTO' || (parada.status !== 'A_CAMINHO' && parada.status !== 'NO_LOCAL')) {
        throw ErroDominio.transicaoInvalida('Ocorrências são registradas na parada atual (a caminho ou no local).');
      }
      const ocorrencia = await tx.ocorrencia.create({
        data: {
          paradaId,
          motoristaId: ctx.motoristaId,
          tipo: dados.tipo,
          descricao: dados.descricao ?? null,
          ocorridaEm: ctx.ocorridoEm ?? new Date(),
        },
        select: { id: true },
      });
      await this.evento(tx, ctx, rota.id, 'OCORRENCIA_REGISTRADA', null, null, {
        paradaId,
        ocorrenciaId: ocorrencia.id,
        tipo: dados.tipo,
      });
      return mapearRota(await obterRota(tx, rota.id));
    });
  }

  // ---------- apoio ----------

  /** Grava a foto com chave aleatória na pasta da rota do serviço; serviço de outro motorista não grava nada. */
  private async salvarFoto(ctx: Contexto, servicoId: string, foto: Buffer): Promise<string | null> {
    const servico = await this.prisma.servico.findFirst({
      where: { id: servicoId, parada: { rota: { motoristaId: ctx.motoristaId } } },
      select: { parada: { select: { rotaId: true } } },
    });
    if (!servico) return null;
    const chave = chaveComprovante(servico.parada.rotaId, randomUUID());
    await this.armazenamento.salvar(chave, foto);
    return chave;
  }

  private async apagarFoto(chave: string): Promise<void> {
    await this.armazenamento.apagar(chave).catch((erro: unknown) => {
      this.logger.warn(`Foto de comprovante não usada ficou no armazenamento: ${erro instanceof Error ? erro.message : 'erro'}`);
    });
  }

  private exigir<T>(resultado: { ok: true; valor: T } | { ok: false; motivo: string }): NonNullable<T> {
    if (!resultado.ok) throw ErroDominio.transicaoInvalida(resultado.motivo);
    if (resultado.valor === null || resultado.valor === undefined) {
      throw new Error('Transição sem status de destino em comando do motorista.');
    }
    return resultado.valor;
  }

  /** Confere o dono antes e depois da trava (a rota pode ter sido transferida no meio-tempo). */
  private async rotaDoMotorista(tx: Tx, ctx: Contexto, rotaId: string): Promise<RotaRegistro> {
    const dono = { id: rotaId, motoristaId: ctx.motoristaId, status: { not: 'RASCUNHO' as const } };
    if (!(await tx.rota.findFirst({ where: dono, select: { id: true } }))) {
      throw ErroDominio.naoEncontrado(NAO_ENCONTRADA);
    }
    await travarRotaSemVersao(tx, rotaId);
    const rota = await obterRota(tx, rotaId);
    if (rota.motorista?.id !== ctx.motoristaId || rota.status === 'RASCUNHO') {
      throw ErroDominio.naoEncontrado(NAO_ENCONTRADA);
    }
    return rota;
  }

  private async paradaDoMotorista(tx: Tx, ctx: Contexto, paradaId: string) {
    const encontrada = await tx.parada.findFirst({
      where: { id: paradaId, rota: { motoristaId: ctx.motoristaId, status: { not: 'RASCUNHO' } } },
      select: { rotaId: true },
    });
    if (!encontrada) throw ErroDominio.naoEncontrado('Parada não encontrada.');
    const rota = await this.rotaDoMotorista(tx, ctx, encontrada.rotaId);
    const parada = rota.paradas.find((p) => p.id === paradaId);
    if (!parada) throw ErroDominio.naoEncontrado('Parada não encontrada.');
    return { rota, parada };
  }

  private async servicoDoMotorista(
    tx: Tx,
    ctx: Contexto,
    servicoId: string,
  ): Promise<{ rota: RotaRegistro; parada: ParadaRegistro; servico: ServicoRegistro }> {
    const encontrado = await tx.servico.findFirst({
      where: { id: servicoId, parada: { rota: { motoristaId: ctx.motoristaId, status: { not: 'RASCUNHO' } } } },
      select: { paradaId: true },
    });
    if (!encontrado) throw ErroDominio.naoEncontrado('Serviço não encontrado.');
    const { rota, parada } = await this.paradaDoMotorista(tx, ctx, encontrado.paradaId);
    const servico = parada.servicos.find((s) => s.id === servicoId);
    if (!servico) throw ErroDominio.naoEncontrado('Serviço não encontrado.');
    return { rota, parada, servico };
  }

  /** Parada com todos os serviços terminais finaliza; rota com todas as paradas terminais conclui. */
  private async concluirSePreciso(tx: Tx, ctx: Contexto, rotaId: string, paradaId: string): Promise<void> {
    const rota = await obterRota(tx, rotaId);
    const parada = rota.paradas.find((p) => p.id === paradaId)!;
    if (parada.status === 'FINALIZADA' || !paradaDeveFinalizar(parada.servicos.map((s) => s.status))) return;

    await tx.parada.update({ where: { id: paradaId }, data: { status: 'FINALIZADA', finalizadaEm: new Date() } });
    await this.evento(tx, ctx, rotaId, 'PARADA_FINALIZADA', parada.status, 'FINALIZADA', { paradaId }, true);

    const statusParadas = rota.paradas.map((p) => (p.id === paradaId ? 'FINALIZADA' : p.status));
    if (!rotaDeveConcluir(statusParadas)) return;
    const conclusao = transicaoRota(rota.status, 'CONCLUIR', 'SISTEMA');
    if (!conclusao.ok || !conclusao.valor) return;
    await tx.rota.update({ where: { id: rotaId }, data: { status: conclusao.valor, concluidaEm: new Date() } });
    await this.evento(tx, ctx, rotaId, 'ROTA_CONCLUIDA', rota.status, conclusao.valor, {}, true);
  }

  private evento(
    tx: Tx,
    ctx: Contexto,
    rotaId: string,
    tipo: Parameters<typeof registrarEvento>[1]['tipo'],
    statusAnterior: string | null,
    statusNovo: string | null,
    dados: Record<string, string | number | boolean> = {},
    automatico = false,
  ): Promise<void> {
    return registrarEvento(tx, {
      rotaId,
      tipo,
      statusAnterior,
      statusNovo,
      // Finalização de parada e conclusão de rota são automáticas (autor nulo = sistema).
      autorUsuarioId: automatico ? null : ctx.usuario.usuarioId,
      ocorridoEm: automatico ? null : ctx.ocorridoEm,
      dados,
    });
  }
}

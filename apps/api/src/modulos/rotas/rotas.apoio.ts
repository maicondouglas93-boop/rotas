import { formatarEndereco, type TipoEventoRota, type TipoServico } from '@rotas/shared';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { rotaSelect, type RotaRegistro } from './rotas.mapper.js';

// Operações de banco reutilizadas pelos services de rotas. Todas recebem o cliente da transação.

export type Tx = Prisma.TransactionClient;

export async function obterRota(tx: Tx, id: string): Promise<RotaRegistro> {
  const rota = await tx.rota.findUnique({ where: { id }, select: rotaSelect });
  if (!rota) throw ErroDominio.naoEncontrado('Rota não encontrada.');
  return rota;
}

/**
 * Trava a linha da rota conferindo a versão enviada pelo admin e já incrementa a versão.
 * Tudo que for lido depois, dentro da mesma transação, reflete o estado atual (sem corrida com outros comandos).
 */
export async function travarRota(tx: Tx, id: string, versao: number): Promise<RotaRegistro> {
  const resultado = await tx.rota.updateMany({ where: { id, versao }, data: { versao: { increment: 1 } } });
  if (resultado.count === 0) {
    await obterRota(tx, id);
    throw ErroDominio.conflitoVersao();
  }
  return obterRota(tx, id);
}

export async function garantirMotoristaAtivo(tx: Tx, motoristaId: string): Promise<void> {
  const motorista = await tx.motorista.findUnique({
    where: { id: motoristaId },
    select: { desativadoEm: true, usuario: { select: { ativo: true } } },
  });
  if (!motorista) throw ErroDominio.regraNegocio('Motorista não encontrado.');
  if (motorista.desativadoEm !== null || !motorista.usuario.ativo) {
    throw ErroDominio.regraNegocio('O motorista escolhido está desativado. Escolha outro.');
  }
}

const empresaSnapshotSelect = {
  id: true,
  nomeFantasia: true,
  logradouro: true,
  numero: true,
  bairro: true,
  cidade: true,
  uf: true,
  cep: true,
  latitude: true,
  longitude: true,
  telefone: true,
  whatsapp: true,
  arquivadaEm: true,
} satisfies Prisma.EmpresaSelect;

export type EmpresaSnapshot = Prisma.EmpresaGetPayload<{ select: typeof empresaSnapshotSelect }>;

/** Carrega as empresas das paradas novas numa consulta só; recusa inexistente ou arquivada. */
export async function carregarEmpresasParaParadas(tx: Tx, ids: readonly string[]): Promise<Map<string, EmpresaSnapshot>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const empresas = await tx.empresa.findMany({ where: { id: { in: unicos } }, select: empresaSnapshotSelect });
  const porId = new Map(empresas.map((e) => [e.id, e]));
  for (const id of unicos) {
    const empresa = porId.get(id);
    if (!empresa) throw ErroDominio.regraNegocio('Uma das empresas informadas não existe.');
    if (empresa.arquivadaEm !== null) {
      throw ErroDominio.regraNegocio(`A empresa ${empresa.nomeFantasia} está arquivada e não pode entrar em uma rota.`);
    }
  }
  return porId;
}

/** Snapshot da empresa gravado na parada: o histórico não muda quando o cadastro muda. */
export function snapshotEmpresa(empresa: EmpresaSnapshot) {
  return {
    nomeEmpresa: empresa.nomeFantasia,
    enderecoFormatado: formatarEndereco(empresa),
    latitude: empresa.latitude,
    longitude: empresa.longitude,
    telefone: empresa.telefone,
    whatsapp: empresa.whatsapp,
  };
}

export function dadosParadaNova(
  rotaId: string,
  sequencia: number,
  empresa: EmpresaSnapshot,
  servicos: readonly TipoServico[],
  observacoes: string | null,
): Prisma.ParadaCreateInput {
  return {
    rota: { connect: { id: rotaId } },
    empresa: { connect: { id: empresa.id } },
    sequencia,
    ...snapshotEmpresa(empresa),
    observacoes,
    servicos: { create: servicos.map((tipo) => ({ tipo })) },
  };
}

/** Desloca todas as sequências para uma faixa temporária, liberando 1..n para a nova ordem. */
export async function liberarSequencias(tx: Tx, rotaId: string): Promise<void> {
  await tx.$executeRaw`UPDATE paradas SET sequencia = sequencia + 100000 WHERE rota_id = ${rotaId}::uuid`;
}

export interface NovoEvento {
  rotaId: string;
  tipo: TipoEventoRota;
  statusAnterior?: string | null;
  statusNovo?: string | null;
  /** `null` quando a ação é automática (sistema). */
  autorUsuarioId: string | null;
  dados?: Prisma.InputJsonObject;
}

/** Histórico append-only: grava o evento na mesma transação da mudança. */
export async function registrarEvento(tx: Tx, evento: NovoEvento): Promise<void> {
  await tx.rotaEvento.create({
    data: {
      rotaId: evento.rotaId,
      tipo: evento.tipo,
      statusAnterior: evento.statusAnterior ?? null,
      statusNovo: evento.statusNovo ?? null,
      autorUsuarioId: evento.autorUsuarioId,
      dados: evento.dados ?? {},
    },
  });
}

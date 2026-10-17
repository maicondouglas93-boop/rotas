import { assinaturaSchema, type ComprovanteRota, type EventoRota, type OcorrenciaRota, type Rota, type RotaResumo } from '@rotas/shared';
import type { Prisma } from '../../generated/prisma/client.js';

/** `@db.Date` chega como meia-noite UTC; a API trafega `AAAA-MM-DD`. */
export function paraData(valor: string): Date {
  return new Date(`${valor}T00:00:00.000Z`);
}

export function deData(valor: Date): string {
  return valor.toISOString().slice(0, 10);
}

function iso(valor: Date | null): string | null {
  return valor ? valor.toISOString() : null;
}

const motoristaResumoSelect = {
  select: { id: true, nome: true, desativadoEm: true, usuario: { select: { ativo: true } } },
} satisfies { select: Prisma.MotoristaSelect };

export const rotaSelect = {
  id: true,
  nome: true,
  dataPrevista: true,
  status: true,
  versao: true,
  ordemOrigem: true,
  distanciaEstimadaM: true,
  duracaoEstimadaS: true,
  enviadaEm: true,
  recebidaEm: true,
  iniciadaEm: true,
  concluidaEm: true,
  canceladaEm: true,
  motivoCancelamento: true,
  rotaOrigemId: true,
  criadoEm: true,
  atualizadoEm: true,
  motorista: motoristaResumoSelect,
  paradas: {
    orderBy: { sequencia: 'asc' },
    select: {
      id: true,
      sequencia: true,
      status: true,
      empresaId: true,
      nomeEmpresa: true,
      enderecoFormatado: true,
      latitude: true,
      longitude: true,
      telefone: true,
      whatsapp: true,
      observacoes: true,
      chegadaEm: true,
      finalizadaEm: true,
      servicos: {
        orderBy: { tipo: 'asc' },
        select: { id: true, tipo: true, status: true, concluidoEm: true },
      },
    },
  },
} satisfies Prisma.RotaSelect;

export type RotaRegistro = Prisma.RotaGetPayload<{ select: typeof rotaSelect }>;

export const rotaResumoSelect = {
  id: true,
  nome: true,
  dataPrevista: true,
  status: true,
  versao: true,
  enviadaEm: true,
  concluidaEm: true,
  atualizadoEm: true,
  motorista: motoristaResumoSelect,
} satisfies Prisma.RotaSelect;

export type RotaResumoRegistro = Prisma.RotaGetPayload<{ select: typeof rotaResumoSelect }>;

type MotoristaResumoRegistro = RotaRegistro['motorista'];

function mapearMotoristaResumo(motorista: MotoristaResumoRegistro): Rota['motorista'] {
  if (!motorista) return null;
  return {
    id: motorista.id,
    nome: motorista.nome,
    ativo: motorista.desativadoEm === null && motorista.usuario.ativo,
  };
}

export function mapearRota(registro: RotaRegistro): Rota {
  return {
    id: registro.id,
    nome: registro.nome,
    dataPrevista: deData(registro.dataPrevista),
    status: registro.status,
    versao: registro.versao,
    motorista: mapearMotoristaResumo(registro.motorista),
    ordemOrigem: registro.ordemOrigem,
    distanciaEstimadaM: registro.distanciaEstimadaM,
    duracaoEstimadaS: registro.duracaoEstimadaS,
    enviadaEm: iso(registro.enviadaEm),
    recebidaEm: iso(registro.recebidaEm),
    iniciadaEm: iso(registro.iniciadaEm),
    concluidaEm: iso(registro.concluidaEm),
    canceladaEm: iso(registro.canceladaEm),
    motivoCancelamento: registro.motivoCancelamento,
    rotaOrigemId: registro.rotaOrigemId,
    criadoEm: registro.criadoEm.toISOString(),
    atualizadoEm: registro.atualizadoEm.toISOString(),
    paradas: registro.paradas.map((p) => ({
      id: p.id,
      sequencia: p.sequencia,
      status: p.status,
      empresaId: p.empresaId,
      nomeEmpresa: p.nomeEmpresa,
      enderecoFormatado: p.enderecoFormatado,
      latitude: p.latitude,
      longitude: p.longitude,
      telefone: p.telefone,
      whatsapp: p.whatsapp,
      observacoes: p.observacoes,
      chegadaEm: iso(p.chegadaEm),
      finalizadaEm: iso(p.finalizadaEm),
      servicos: p.servicos.map((s) => ({ id: s.id, tipo: s.tipo, status: s.status, concluidoEm: iso(s.concluidoEm) })),
    })),
  };
}

export function mapearRotaResumo(
  registro: RotaResumoRegistro,
  contagem: { total: number; concluidas: number },
): RotaResumo {
  return {
    id: registro.id,
    nome: registro.nome,
    dataPrevista: deData(registro.dataPrevista),
    status: registro.status,
    versao: registro.versao,
    motorista: mapearMotoristaResumo(registro.motorista),
    enviadaEm: iso(registro.enviadaEm),
    concluidaEm: iso(registro.concluidaEm),
    atualizadoEm: registro.atualizadoEm.toISOString(),
    totalParadas: contagem.total,
    paradasConcluidas: contagem.concluidas,
  };
}

export const eventoSelect = {
  id: true,
  tipo: true,
  statusAnterior: true,
  statusNovo: true,
  autorUsuarioId: true,
  dados: true,
  ocorridoEm: true,
  criadoEm: true,
} satisfies Prisma.RotaEventoSelect;

export function mapearEvento(registro: Prisma.RotaEventoGetPayload<{ select: typeof eventoSelect }>): EventoRota {
  const dados = registro.dados;
  return {
    id: registro.id,
    tipo: registro.tipo,
    statusAnterior: registro.statusAnterior,
    statusNovo: registro.statusNovo,
    autorUsuarioId: registro.autorUsuarioId,
    dados: dados !== null && typeof dados === 'object' && !Array.isArray(dados) ? (dados as Record<string, unknown>) : {},
    ocorridoEm: iso(registro.ocorridoEm),
    criadoEm: registro.criadoEm.toISOString(),
  };
}

export const ocorrenciaSelect = {
  id: true,
  paradaId: true,
  servicoId: true,
  tipo: true,
  descricao: true,
  ocorridaEm: true,
  registradaEm: true,
  motorista: { select: { id: true, nome: true } },
} satisfies Prisma.OcorrenciaSelect;

export function mapearOcorrencia(registro: Prisma.OcorrenciaGetPayload<{ select: typeof ocorrenciaSelect }>): OcorrenciaRota {
  return {
    id: registro.id,
    paradaId: registro.paradaId,
    servicoId: registro.servicoId,
    tipo: registro.tipo,
    descricao: registro.descricao,
    ocorridaEm: registro.ocorridaEm.toISOString(),
    registradaEm: registro.registradaEm.toISOString(),
    motorista: { id: registro.motorista.id, nome: registro.motorista.nome },
  };
}

export const comprovanteSelect = {
  id: true,
  servicoId: true,
  nomeRecebedor: true,
  assinatura: true,
  fotoChave: true,
  registradoEm: true,
  servico: { select: { paradaId: true } },
  motorista: { select: { id: true, nome: true } },
} satisfies Prisma.ComprovanteSelect;

/** `fotoUrl` vem pronto (link assinado gerado na hora pelo armazenamento). */
export function mapearComprovante(
  registro: Prisma.ComprovanteGetPayload<{ select: typeof comprovanteSelect }>,
  fotoUrl: string | null,
): ComprovanteRota {
  const assinatura = assinaturaSchema.safeParse(registro.assinatura);
  return {
    id: registro.id,
    servicoId: registro.servicoId,
    paradaId: registro.servico.paradaId,
    nomeRecebedor: registro.nomeRecebedor,
    assinatura: assinatura.success ? assinatura.data : null,
    fotoUrl,
    registradoEm: registro.registradoEm.toISOString(),
    motorista: { id: registro.motorista.id, nome: registro.motorista.nome },
  };
}

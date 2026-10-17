import { formatarEndereco, mascararDocumento, type Empresa } from '@rotas/shared';
import type { Prisma } from '../../generated/prisma/client.js';

export const empresaSelect = {
  id: true,
  nomeFantasia: true,
  razaoSocial: true,
  documento: true,
  telefone: true,
  whatsapp: true,
  logradouro: true,
  numero: true,
  complemento: true,
  bairro: true,
  cidade: true,
  uf: true,
  cep: true,
  latitude: true,
  longitude: true,
  fonteLocalizacao: true,
  responsavel: true,
  horarioFuncionamento: true,
  observacoes: true,
  arquivadaEm: true,
  criadoEm: true,
  atualizadoEm: true,
} satisfies Prisma.EmpresaSelect;

export type EmpresaRegistro = Prisma.EmpresaGetPayload<{ select: typeof empresaSelect }>;

export function mapearEmpresa(registro: EmpresaRegistro): Empresa {
  return {
    id: registro.id,
    nomeFantasia: registro.nomeFantasia,
    razaoSocial: registro.razaoSocial,
    documentoMascarado: mascararDocumento(registro.documento),
    telefone: registro.telefone,
    whatsapp: registro.whatsapp,
    logradouro: registro.logradouro,
    numero: registro.numero,
    complemento: registro.complemento,
    bairro: registro.bairro,
    cidade: registro.cidade,
    uf: registro.uf,
    cep: registro.cep,
    enderecoFormatado: formatarEndereco({
      logradouro: registro.logradouro,
      numero: registro.numero,
      bairro: registro.bairro,
      cidade: registro.cidade,
      uf: registro.uf,
      cep: registro.cep,
    }),
    latitude: registro.latitude,
    longitude: registro.longitude,
    fonteLocalizacao: registro.fonteLocalizacao,
    responsavel: registro.responsavel,
    horarioFuncionamento: registro.horarioFuncionamento,
    observacoes: registro.observacoes,
    arquivadaEm: registro.arquivadaEm ? registro.arquivadaEm.toISOString() : null,
    criadoEm: registro.criadoEm.toISOString(),
    atualizadoEm: registro.atualizadoEm.toISOString(),
  };
}

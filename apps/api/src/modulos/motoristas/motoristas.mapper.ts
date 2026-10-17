import type { Motorista } from '@rotas/shared';
import type { Prisma } from '../../generated/prisma/client.js';

export const motoristaSelect = {
  id: true,
  usuarioId: true,
  nome: true,
  telefone: true,
  desativadoEm: true,
  criadoEm: true,
  atualizadoEm: true,
  usuario: {
    select: {
      email: true,
      ativo: true,
      deveTrocarSenha: true,
      atualizadoEm: true,
    },
  },
} satisfies Prisma.MotoristaSelect;

export type MotoristaRegistro = Prisma.MotoristaGetPayload<{ select: typeof motoristaSelect }>;

export function mapearMotorista(registro: MotoristaRegistro): Motorista {
  // Editar o e-mail atualiza só o usuário; a data exibida é a mais recente das duas.
  const atualizadoEm =
    registro.usuario.atualizadoEm > registro.atualizadoEm ? registro.usuario.atualizadoEm : registro.atualizadoEm;

  return {
    id: registro.id,
    usuarioId: registro.usuarioId,
    nome: registro.nome,
    email: registro.usuario.email,
    telefone: registro.telefone,
    ativo: registro.usuario.ativo && registro.desativadoEm === null,
    desativadoEm: registro.desativadoEm ? registro.desativadoEm.toISOString() : null,
    deveTrocarSenha: registro.usuario.deveTrocarSenha,
    criadoEm: registro.criadoEm.toISOString(),
    atualizadoEm: atualizadoEm.toISOString(),
  };
}

import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { PerfilUsuario } from '@rotas/shared';
import type { Request } from 'express';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import type { UsuarioAutenticado } from './tipos.js';

export const CHAVE_PUBLICO = 'auth:publico';
export const CHAVE_PERFIS = 'auth:perfis';
export const CHAVE_PERMITIR_SENHA_TEMPORARIA = 'auth:permitir_senha_temporaria';

/** Marca rota ou controller como público (dispensa JWT e verificação de perfil). */
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);

/** Define os perfis autorizados a acessar a rota ou controller. */
export const Perfis = (...perfis: [PerfilUsuario, ...PerfilUsuario[]]) =>
  SetMetadata(CHAVE_PERFIS, perfis);

/** Permite que usuários com `deveTrocarSenha = true` acessem o endpoint. */
export const PermitirSenhaTemporaria = () => SetMetadata(CHAVE_PERMITIR_SENHA_TEMPORARIA, true);

/** Injeta o `UsuarioAutenticado` validado pelo `AutenticacaoGuard`. */
export const UsuarioAtual = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const req = contexto.switchToHttp().getRequest<Request>();
    if (!req.usuario) {
      throw ErroDominio.naoAutenticado();
    }
    return req.usuario;
  },
);

import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PerfilUsuario } from '@rotas/shared';
import type { Request } from 'express';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import { CHAVE_PERFIS, CHAVE_PUBLICO } from './decoradores.js';

@Injectable()
export class PerfisGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const publico = this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publico) {
      return true;
    }

    const perfisPermitidos = this.reflector.getAllAndOverride<PerfilUsuario[] | undefined>(
      CHAVE_PERFIS,
      [contexto.getHandler(), contexto.getClass()],
    );
    // Negar por padrão quando a rota não declarar @Perfis.
    if (!perfisPermitidos || perfisPermitidos.length === 0) {
      throw ErroDominio.semPermissao();
    }

    const req = contexto.switchToHttp().getRequest<Request>();
    if (!req.usuario) {
      throw ErroDominio.naoAutenticado();
    }

    if (!perfisPermitidos.includes(req.usuario.perfil)) {
      throw ErroDominio.semPermissao();
    }

    return true;
  }
}

import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import { CHAVE_PERMITIR_SENHA_TEMPORARIA, CHAVE_PUBLICO } from './decoradores.js';
import { AcessoService } from './acesso.service.js';

@Injectable()
export class AutenticacaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly acesso: AcessoService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publico) {
      return true;
    }

    const req = contexto.switchToHttp().getRequest<Request>();
    const token = extrairTokenBearer(req);
    if (!token) {
      throw ErroDominio.naoAutenticado();
    }

    const { usuario, deveTrocarSenha } = await this.acesso.validar(token);

    if (deveTrocarSenha) {
      const permitirTemporaria = this.reflector.getAllAndOverride<boolean>(
        CHAVE_PERMITIR_SENHA_TEMPORARIA,
        [contexto.getHandler(), contexto.getClass()],
      );
      if (!permitirTemporaria) {
        throw ErroDominio.trocaSenhaObrigatoria('Troque sua senha para continuar.');
      }
    }

    req.usuario = usuario;

    return true;
  }
}

function extrairTokenBearer(req: Request): string | null {
  const cabecalho = req.header('authorization');
  if (!cabecalho) return null;
  const [esquema, token, ...resto] = cabecalho.trim().split(/\s+/);
  if (!esquema || esquema.toLowerCase() !== 'bearer' || !token || resto.length > 0) {
    return null;
  }
  return token;
}

import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  refreshAppSchema,
  type ClienteAuth,
  type LoginEntrada,
  type Sessao,
  type TrocarSenhaEntrada,
  type UsuarioSessao,
} from '@rotas/shared';
import type { CookieOptions, Request, Response } from 'express';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import { ENV, type Env } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SenhasService } from './senhas.service.js';
import {
  CAMINHO_COOKIE_REFRESH,
  NOME_COOKIE_REFRESH,
  type UsuarioAutenticado,
} from './tipos.js';
import { TokensService } from './tokens.service.js';

const MENSAGEM_CREDENCIAIS_INVALIDAS = 'E-mail ou senha inválidos.';
const MENSAGEM_SENHA_ATUAL_INCORRETA = 'Senha atual incorreta.';
const MAX_USER_AGENT = 300;

const usuarioAuthSelect = {
  id: true,
  email: true,
  senhaHash: true,
  perfil: true,
  ativo: true,
  deveTrocarSenha: true,
  motorista: {
    select: {
      id: true,
      nome: true,
      desativadoEm: true,
    },
  },
} satisfies Prisma.UsuarioSelect;

type UsuarioAuthRegistro = Prisma.UsuarioGetPayload<{ select: typeof usuarioAuthSelect }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly senhas: SenhasService,
    private readonly tokens: TokensService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async login(dados: LoginEntrada, req: Request, res: Response): Promise<Sessao> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dados.email },
      select: usuarioAuthSelect,
    });

    const senhaValida = await this.senhas.verificar(usuario?.senhaHash ?? null, dados.senha);
    if (!usuario || !senhaValida || !usuarioAtivo(usuario)) {
      throw ErroDominio.naoAutenticado(MENSAGEM_CREDENCIAIS_INVALIDAS);
    }

    const familiaId = randomUUID();
    const refresh = this.tokens.gerarRefreshToken();
    const { ip, userAgent } = extrairMetadadosRequisicao(req);

    await this.prisma.sessaoRefresh.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: refresh.tokenHash,
        familiaId,
        expiraEm: refresh.expiraEm,
        userAgent,
        ip,
      },
    });

    return this.montarRespostaSessao(usuario, familiaId, refresh.token, dados.cliente, res);
  }

  async refresh(corpoBruto: unknown, req: Request, res: Response): Promise<Sessao> {
    const { token, cliente } = this.extrairEntradaRefresh(corpoBruto, req);
    const tokenHash = this.tokens.hashRefreshToken(token);
    const agora = new Date();

    const sessaoAtual = await this.prisma.sessaoRefresh.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        usuarioId: true,
        familiaId: true,
        expiraEm: true,
        revogadaEm: true,
        usuario: {
          select: usuarioAuthSelect,
        },
      },
    });

    if (!sessaoAtual) {
      throw ErroDominio.naoAutenticado();
    }

    // Reuso de refresh token já revogado: revoga toda a família imediatamente e exige novo login.
    if (sessaoAtual.revogadaEm !== null) {
      await this.revogarFamilia(sessaoAtual.familiaId, agora);
      throw ErroDominio.naoAutenticado();
    }

    if (sessaoAtual.expiraEm <= agora || !usuarioAtivo(sessaoAtual.usuario)) {
      throw ErroDominio.naoAutenticado();
    }

    const { ip, userAgent } = extrairMetadadosRequisicao(req);
    const novoRefresh = this.tokens.gerarRefreshToken();
    const novaSessaoId = randomUUID();

    const rotacionou = await this.prisma.$transaction(async (tx) => {
      const atualizados = await tx.sessaoRefresh.updateMany({
        where: {
          id: sessaoAtual.id,
          revogadaEm: null,
          expiraEm: { gt: agora },
        },
        data: {
          revogadaEm: agora,
          substituidaPorId: novaSessaoId,
        },
      });

      if (atualizados.count === 0) {
        return false;
      }

      await tx.sessaoRefresh.create({
        data: {
          id: novaSessaoId,
          usuarioId: sessaoAtual.usuarioId,
          tokenHash: novoRefresh.tokenHash,
          familiaId: sessaoAtual.familiaId,
          expiraEm: novoRefresh.expiraEm,
          userAgent,
          ip,
        },
      });

      return true;
    });

    if (!rotacionou) {
      await this.revogarFamilia(sessaoAtual.familiaId, agora);
      throw ErroDominio.naoAutenticado();
    }

    return this.montarRespostaSessao(
      sessaoAtual.usuario,
      sessaoAtual.familiaId,
      novoRefresh.token,
      cliente,
      res,
    );
  }

  async logout(corpoBruto: unknown, req: Request, res: Response): Promise<void> {
    this.limparCookieRefresh(res);

    const token = this.extrairTokenLogout(corpoBruto, req);
    if (!token) {
      return;
    }

    const tokenHash = this.tokens.hashRefreshToken(token);
    const sessao = await this.prisma.sessaoRefresh.findUnique({
      where: { tokenHash },
      select: { familiaId: true },
    });

    if (sessao) {
      await this.revogarFamilia(sessao.familiaId, new Date());
    }
  }

  async trocarSenha(dados: TrocarSenhaEntrada, autenticado: UsuarioAutenticado): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: autenticado.usuarioId },
      select: {
        id: true,
        email: true,
        senhaHash: true,
        ativo: true,
      },
    });

    if (!usuario || !usuario.ativo) {
      throw ErroDominio.naoAutenticado();
    }

    const senhaAtualCorreta = await this.senhas.verificar(usuario.senhaHash, dados.senhaAtual);
    if (!senhaAtualCorreta) {
      throw ErroDominio.regraNegocio(MENSAGEM_SENHA_ATUAL_INCORRETA);
    }

    this.senhas.validarPoliticaNovaSenha(dados.novaSenha, usuario.email);
    const novoHash = await this.senhas.gerarHash(dados.novaSenha);
    const agora = new Date();

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          senhaHash: novoHash,
          deveTrocarSenha: false,
        },
      }),
      this.prisma.sessaoRefresh.updateMany({
        where: {
          usuarioId: usuario.id,
          familiaId: { not: autenticado.sessaoId },
          revogadaEm: null,
        },
        data: {
          revogadaEm: agora,
        },
      }),
    ]);
  }

  async eu(autenticado: UsuarioAutenticado): Promise<UsuarioSessao> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: autenticado.usuarioId },
      select: usuarioAuthSelect,
    });

    if (!usuario || !usuarioAtivo(usuario)) {
      throw ErroDominio.naoAutenticado();
    }

    return mapearUsuarioSessao(usuario);
  }

  private async montarRespostaSessao(
    usuario: UsuarioAuthRegistro,
    familiaId: string,
    refreshToken: string,
    cliente: ClienteAuth,
    res: Response,
  ): Promise<Sessao> {
    const { accessToken, expiraEm } = await this.tokens.emitirAccessToken({
      usuarioId: usuario.id,
      perfil: usuario.perfil,
      motoristaId: usuario.motorista?.id ?? null,
      familiaId,
    });

    const usuarioMapeado = mapearUsuarioSessao(usuario);

    if (cliente === 'painel') {
      this.gravarCookieRefresh(res, refreshToken);
      return {
        accessToken,
        expiraEm,
        usuario: usuarioMapeado,
      };
    }

    return {
      accessToken,
      expiraEm,
      refreshToken,
      usuario: usuarioMapeado,
    };
  }

  private extrairEntradaRefresh(
    corpoBruto: unknown,
    req: Request,
  ): { token: string; cliente: ClienteAuth } {
    const tokenCookie = lerCookieRefresh(req);
    if (tokenCookie !== null) {
      const origem = req.header('origin');
      if (!origem || !this.env.CORS_ORIGENS.includes(origem)) {
        throw ErroDominio.semPermissao('Origem não autorizada para renovação de sessão.');
      }
      return { token: tokenCookie, cliente: 'painel' };
    }

    // Sem cookie e sem corpo: não há sessão para renovar (o painel testa isso ao abrir).
    if (
      corpoBruto === undefined ||
      corpoBruto === null ||
      (typeof corpoBruto === 'object' && Object.keys(corpoBruto).length === 0)
    ) {
      throw ErroDominio.naoAutenticado();
    }

    const validado = refreshAppSchema.safeParse(corpoBruto);
    if (!validado.success) {
      throw ErroDominio.validacao(validado.error.issues);
    }
    return { token: validado.data.refreshToken, cliente: 'app' };
  }

  private extrairTokenLogout(corpoBruto: unknown, req: Request): string | null {
    const tokenCookie = lerCookieRefresh(req);
    if (tokenCookie !== null) {
      return tokenCookie;
    }

    if (
      corpoBruto === undefined ||
      corpoBruto === null ||
      (typeof corpoBruto === 'object' && Object.keys(corpoBruto).length === 0)
    ) {
      return null;
    }

    const validado = refreshAppSchema.safeParse(corpoBruto);
    if (!validado.success) {
      throw ErroDominio.validacao(validado.error.issues);
    }
    return validado.data.refreshToken;
  }

  private async revogarFamilia(familiaId: string, agora: Date): Promise<void> {
    await this.prisma.sessaoRefresh.updateMany({
      where: {
        familiaId,
        revogadaEm: null,
      },
      data: {
        revogadaEm: agora,
      },
    });
  }

  private opcoesCookieBase(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: CAMINHO_COOKIE_REFRESH,
      ...(this.env.COOKIE_DOMINIO ? { domain: this.env.COOKIE_DOMINIO } : {}),
    };
  }

  private gravarCookieRefresh(res: Response, refreshToken: string): void {
    res.cookie(NOME_COOKIE_REFRESH, refreshToken, {
      ...this.opcoesCookieBase(),
      maxAge: this.env.REFRESH_DIAS * 24 * 60 * 60 * 1000,
    });
  }

  private limparCookieRefresh(res: Response): void {
    res.clearCookie(NOME_COOKIE_REFRESH, this.opcoesCookieBase());
  }
}

function usuarioAtivo(usuario: UsuarioAuthRegistro): boolean {
  if (!usuario.ativo) return false;
  if (usuario.perfil === 'MOTORISTA') {
    return usuario.motorista !== null && usuario.motorista.desativadoEm === null;
  }
  return true;
}

function mapearUsuarioSessao(usuario: UsuarioAuthRegistro): UsuarioSessao {
  return {
    id: usuario.id,
    email: usuario.email,
    perfil: usuario.perfil,
    nome: usuario.motorista?.nome ?? null,
    deveTrocarSenha: usuario.deveTrocarSenha,
  };
}

function lerCookieRefresh(req: Request): string | null {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const valor = cookies?.[NOME_COOKIE_REFRESH];
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim();
  return limpo.length > 0 ? limpo : null;
}

function extrairMetadadosRequisicao(req: Request): { ip: string | null; userAgent: string | null } {
  const userAgentBruto = req.header('user-agent')?.trim();
  const userAgent =
    userAgentBruto && userAgentBruto.length > 0 ? userAgentBruto.slice(0, MAX_USER_AGENT) : null;
  const ip = req.ip ?? null;
  return { ip, userAgent };
}

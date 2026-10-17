import type { PerfilUsuario } from '@rotas/shared';

export const NOME_COOKIE_REFRESH = 'rotas_refresh';
export const CAMINHO_COOKIE_REFRESH = '/api/v1/auth';

export interface UsuarioAutenticado {
  usuarioId: string;
  perfil: PerfilUsuario;
  motoristaId: string | null;
  sessaoId: string;
}

export interface PayloadAccessToken {
  sub: string;
  perfil: PerfilUsuario;
  mid?: string;
  sid: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

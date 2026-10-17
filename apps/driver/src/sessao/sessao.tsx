import { useQueryClient } from '@tanstack/react-query';
import { sessaoSchema, usuarioSessaoSchema, type UsuarioSessao } from '@rotas/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  aplicarSessao,
  definirAccessToken,
  observarPerdaDeSessao,
  renovarSessao,
  requisitar,
  requisitarPublico,
} from '../api/cliente';
import { limparFila } from '../fila/fila-comandos';
import {
  apagarRefreshToken,
  apagarUsuarioGuardado,
  guardarUsuario,
  lerRefreshToken,
  lerUsuarioGuardado,
} from './armazenamento';

type EstadoSessao =
  | { situacao: 'carregando' }
  | { situacao: 'anonimo'; motivo?: string }
  | { situacao: 'autenticado'; usuario: UsuarioSessao };

interface ContextoSessao {
  estado: EstadoSessao;
  entrar(email: string, senha: string): Promise<void>;
  sair(): Promise<void>;
  trocarSenha(senhaAtual: string, novaSenha: string): Promise<void>;
}

const Contexto = createContext<ContextoSessao | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSessao>({ situacao: 'carregando' });
  const queryClient = useQueryClient();

  /** Logout local: tokens, usuário guardado, fila e cache (que tem dados das rotas). */
  const encerrarLocalmente = useCallback(
    async (motivo?: string) => {
      definirAccessToken(null);
      await Promise.all([apagarRefreshToken(), apagarUsuarioGuardado(), limparFila()]);
      queryClient.clear();
      setEstado({ situacao: 'anonimo', motivo });
    },
    [queryClient],
  );

  // Ao abrir o app, retoma a sessão pelo refresh guardado no aparelho.
  useEffect(() => {
    renovarSessao()
      .then(async (sessao) => {
        if (!sessao) return setEstado({ situacao: 'anonimo' });
        await guardarUsuario(sessao.usuario);
        setEstado({ situacao: 'autenticado', usuario: sessao.usuario });
      })
      .catch(async () => {
        // Sem rede ao abrir: com sessão guardada segue com o cache; a renovação acontece na próxima chamada.
        const [refresh, usuario] = await Promise.all([lerRefreshToken(), lerUsuarioGuardado()]);
        setEstado(
          refresh && usuario
            ? { situacao: 'autenticado', usuario }
            : { situacao: 'anonimo', motivo: 'Sem conexão. Conecte-se à internet para entrar.' },
        );
      });
  }, []);

  useEffect(
    () =>
      observarPerdaDeSessao(() => {
        void encerrarLocalmente('Sua sessão terminou. Entre novamente.');
      }),
    [encerrarLocalmente],
  );

  const entrar = useCallback(async (email: string, senha: string) => {
    const sessao = sessaoSchema.parse(
      await requisitarPublico('/auth/login', { method: 'POST', corpo: { email, senha, cliente: 'app' } }),
    );
    await aplicarSessao(sessao);
    await guardarUsuario(sessao.usuario);
    setEstado({ situacao: 'autenticado', usuario: sessao.usuario });
  }, []);

  const sair = useCallback(async () => {
    const refreshToken = await lerRefreshToken();
    if (refreshToken) {
      await requisitarPublico('/auth/logout', { method: 'POST', corpo: { refreshToken } }).catch(() => undefined);
    }
    await encerrarLocalmente();
  }, [encerrarLocalmente]);

  const trocarSenha = useCallback(async (senhaAtual: string, novaSenha: string) => {
    await requisitar('/auth/trocar-senha', { method: 'POST', corpo: { senhaAtual, novaSenha } });
    const usuario = usuarioSessaoSchema.parse(await requisitar('/auth/eu'));
    await guardarUsuario(usuario);
    setEstado({ situacao: 'autenticado', usuario });
  }, []);

  const valor = useMemo(() => ({ estado, entrar, sair, trocarSenha }), [estado, entrar, sair, trocarSenha]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): ContextoSessao {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSessao precisa estar dentro de SessaoProvider.');
  return contexto;
}

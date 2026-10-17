'use client';

import { useQueryClient } from '@tanstack/react-query';
import { sessaoSchema, usuarioSessaoSchema, type UsuarioSessao } from '@rotas/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { definirAccessToken, json, observarPerdaDeSessao, renovarSessao, requisitar, requisitarPublico } from './api';

type EstadoSessao =
  | { situacao: 'carregando' }
  | { situacao: 'anonimo' }
  | { situacao: 'autenticado'; usuario: UsuarioSessao };

interface ContextoSessao {
  estado: EstadoSessao;
  entrar(email: string, senha: string): Promise<UsuarioSessao>;
  sair(): Promise<void>;
  recarregarUsuario(): Promise<void>;
}

const Contexto = createContext<ContextoSessao | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSessao>({ situacao: 'carregando' });
  const queryClient = useQueryClient();

  // Ao abrir o painel, tenta recuperar a sessão pelo cookie de refresh.
  useEffect(() => {
    let ativo = true;
    renovarSessao()
      .then((sessao) => {
        if (!ativo) return;
        setEstado(sessao ? { situacao: 'autenticado', usuario: sessao.usuario } : { situacao: 'anonimo' });
      })
      .catch(() => ativo && setEstado({ situacao: 'anonimo' }));
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(
    () =>
      observarPerdaDeSessao(() => {
        queryClient.clear();
        setEstado({ situacao: 'anonimo' });
      }),
    [queryClient],
  );

  const entrar = useCallback(async (email: string, senha: string) => {
    const sessao = sessaoSchema.parse(
      await requisitarPublico('/auth/login', { method: 'POST', body: json({ email, senha, cliente: 'painel' }) }),
    );
    definirAccessToken(sessao.accessToken);
    setEstado({ situacao: 'autenticado', usuario: sessao.usuario });
    return sessao.usuario;
  }, []);

  const sair = useCallback(async () => {
    await requisitarPublico('/auth/logout', { method: 'POST' }).catch(() => undefined);
    definirAccessToken(null);
    queryClient.clear();
    setEstado({ situacao: 'anonimo' });
  }, [queryClient]);

  const recarregarUsuario = useCallback(async () => {
    const usuario = usuarioSessaoSchema.parse(await requisitar('/auth/eu'));
    setEstado({ situacao: 'autenticado', usuario });
  }, []);

  const valor = useMemo(() => ({ estado, entrar, sair, recarregarUsuario }), [estado, entrar, sair, recarregarUsuario]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): ContextoSessao {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSessao precisa estar dentro de SessaoProvider.');
  return contexto;
}

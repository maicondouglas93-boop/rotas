import { act, renderHook } from '@testing-library/react-native';
import { dispensarAviso, DURACAO_AVISO_MS, publicarAviso, useAvisoAdministracao } from './avisos';
import { textoDoAviso } from './tempo-real';

describe('textoDoAviso', () => {
  it('avisa mudanças feitas pela administração, com o nome da rota quando conhecido', () => {
    expect(textoDoAviso('rota.cancelada', { rota: 'Centro — manhã' })).toBe('A administração cancelou a rota: Centro — manhã.');
    expect(textoDoAviso('rota.enviada')).toBe('Nova rota da administração.');
  });

  it('diz qual parada foi cancelada quando ela está no cache', () => {
    expect(textoDoAviso('parada.cancelada', { rota: 'Centro — manhã', parada: 'Mercado São Jorge' })).toBe(
      'A administração cancelou a parada Mercado São Jorge (Centro — manhã).',
    );
    expect(textoDoAviso('parada.cancelada')).toBe('A administração cancelou uma parada.');
  });

  it('não avisa as ações do próprio motorista nem eventos desconhecidos', () => {
    expect(textoDoAviso('parada.chegada', { rota: 'Centro' })).toBeNull();
    expect(textoDoAviso('servico.realizado')).toBeNull();
    expect(textoDoAviso('qualquer.coisa')).toBeNull();
  });
});

describe('avisos da administração', () => {
  afterEach(async () => {
    await act(async () => {
      dispensarAviso();
    });
    jest.useRealTimers();
  });

  it('mostra o último aviso e some ao dispensar', async () => {
    const { result } = await renderHook(() => useAvisoAdministracao());
    expect(result.current).toBeNull();
    await act(async () => {
      publicarAviso('Primeiro.');
    });
    await act(async () => {
      publicarAviso('Segundo.');
    });
    expect(result.current).toBe('Segundo.');
    await act(async () => {
      dispensarAviso();
    });
    expect(result.current).toBeNull();
  });

  it('some sozinho depois do tempo de exibição', async () => {
    jest.useFakeTimers();
    const { result } = await renderHook(() => useAvisoAdministracao());
    await act(async () => {
      publicarAviso('Parada cancelada.');
    });
    await act(async () => {
      jest.advanceTimersByTime(DURACAO_AVISO_MS - 1);
    });
    expect(result.current).toBe('Parada cancelada.');
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBeNull();
  });
});

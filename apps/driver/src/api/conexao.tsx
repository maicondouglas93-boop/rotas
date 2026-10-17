import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { carregarFila, configurarFila, processarFila } from '../fila/fila-comandos';
import { useAplicarRota } from './consultas';

// Ao voltar a rede, o TanStack Query revalida e a fila reenvia.
onlineManager.setEventListener((definirOnline) =>
  NetInfo.addEventListener((estado) => {
    const online = estado.isConnected !== false && estado.isInternetReachable !== false;
    definirOnline(online);
    if (online) void processarFila();
  }),
);

/** Liga a fila ao cache das rotas e revalida quando o app volta ao primeiro plano (ex.: voltando do Waze). */
export function useIntegracaoConexao() {
  const aplicarRota = useAplicarRota();
  const queryClient = useQueryClient();

  useEffect(() => {
    configurarFila({
      aoAtualizarRota: aplicarRota,
      aoRecusar: (comando, mensagem) => {
        void queryClient.invalidateQueries({ queryKey: ['motorista'] });
        Alert.alert('Ação não registrada', `${comando.descricao}: ${mensagem}`);
      },
    });
    void carregarFila().then(() => processarFila());
  }, [aplicarRota, queryClient]);

  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (Platform.OS !== 'web') focusManager.setFocused(estado === 'active');
      if (estado === 'active') void processarFila();
    });
    return () => assinatura.remove();
  }, []);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ErroApi } from '@rotas/shared';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { cores } from '../componentes/tema';
import { SessaoProvider } from '../sessao/sessao';

const UM_DIA_MS = 24 * 60 * 60 * 1000;

// Cache das rotas no aparelho (dados operacionais, sem tokens) para abrir a rota sem sinal.
const persistidor = createAsyncStoragePersister({ storage: AsyncStorage, key: 'rotas.cache-consultas' });

export default function Layout() {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: UM_DIA_MS,
            networkMode: 'offlineFirst',
            retry: (tentativas, erro) => tentativas < 2 && !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500),
          },
        },
      }),
  );

  return (
    <PersistQueryClientProvider client={cliente} persistOptions={{ persister: persistidor, maxAge: UM_DIA_MS }}>
      <SessaoProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: cores.superficie },
            headerTitleStyle: { fontWeight: '700' },
            headerTintColor: cores.texto,
            contentStyle: { backgroundColor: cores.fundo },
          }}
        >
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="trocar-senha" options={{ title: 'Trocar senha' }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
      </SessaoProvider>
    </PersistQueryClientProvider>
  );
}

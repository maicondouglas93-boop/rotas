import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

export default function Layout() {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );

  return (
    <QueryClientProvider client={cliente}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTitleStyle: { fontWeight: '600' } }}>
        <Stack.Screen name="index" options={{ title: 'Minhas rotas' }} />
      </Stack>
    </QueryClientProvider>
  );
}

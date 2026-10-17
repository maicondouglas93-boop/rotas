import { Redirect, Stack } from 'expo-router';
import { useIntegracaoConexao } from '../../api/conexao';
import { useTempoReal } from '../../api/tempo-real';
import { Carregando } from '../../componentes/basicos';
import { cores } from '../../componentes/tema';
import { useSessao } from '../../sessao/sessao';

export default function LayoutApp() {
  const { estado } = useSessao();
  useIntegracaoConexao();
  useTempoReal(estado.situacao === 'autenticado' && !estado.usuario.deveTrocarSenha);

  if (estado.situacao === 'carregando') return <Carregando texto="Abrindo…" />;
  if (estado.situacao === 'anonimo') return <Redirect href="/login" />;
  if (estado.usuario.deveTrocarSenha) return <Redirect href="/trocar-senha" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: cores.fundo },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', fontSize: 18 },
        headerTintColor: cores.texto,
        contentStyle: { backgroundColor: cores.fundo },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Minhas rotas' }} />
      <Stack.Screen name="rotas/[id]/index" options={{ title: 'Rota' }} />
      <Stack.Screen name="rotas/[id]/paradas/[paradaId]" options={{ title: 'Parada' }} />
    </Stack>
  );
}

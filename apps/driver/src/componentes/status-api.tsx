import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { requisitar } from '../api/cliente';

type Saude = { status: 'ok'; versao: string };

export function StatusApi() {
  const consulta = useQuery({
    queryKey: ['saude'],
    queryFn: () => requisitar<Saude>('/saude/pronto'),
  });

  if (consulta.isPending) return <Text style={estilos.texto}>Verificando conexão…</Text>;

  if (consulta.isError) {
    return (
      <View style={estilos.linha}>
        <Text style={estilos.texto}>Sem conexão com o servidor</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => consulta.refetch()}
          style={estilos.botao}
        >
          <Text style={estilos.textoBotao}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  return <Text style={estilos.texto}>Conectado ao servidor · versão {consulta.data.versao}</Text>;
}

const estilos = StyleSheet.create({
  linha: { gap: 12 },
  texto: { fontSize: 16, color: '#1f2937' },
  botao: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
  },
  textoBotao: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
});

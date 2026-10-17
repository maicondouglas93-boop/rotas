import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { requisitar } from '../api/cliente';
import { ALVO_TOQUE, cores, raio } from './tema';

type Saude = { status: 'ok'; versao: string };

/** Linha discreta no login: ponto verde/vermelho e versão do servidor. */
export function StatusApi() {
  const consulta = useQuery({
    queryKey: ['saude'],
    queryFn: () => requisitar<Saude>('/saude/pronto'),
  });

  if (consulta.isPending) {
    return (
      <View style={estilos.linha}>
        <View style={[estilos.ponto, { backgroundColor: cores.bordaForte }]} />
        <Text style={estilos.texto}>Verificando conexão…</Text>
      </View>
    );
  }

  if (consulta.isError) {
    return (
      <View style={estilos.coluna}>
        <View style={estilos.linha}>
          <View style={[estilos.ponto, { backgroundColor: cores.perigo }]} />
          <Text style={estilos.texto}>Sem conexão com o servidor</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => consulta.refetch()}
          style={({ pressed }) => [estilos.botao, pressed && { opacity: 0.85 }]}
        >
          <Text style={estilos.textoBotao}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={estilos.linha}>
      <View style={[estilos.ponto, { backgroundColor: cores.sucesso }]} />
      <Text style={estilos.texto}>Conectado ao servidor · versão {consulta.data.versao}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: 12, alignItems: 'center' },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ponto: { width: 8, height: 8, borderRadius: raio.pilula },
  texto: { fontSize: 15, color: cores.textoSecundario },
  botao: {
    minHeight: ALVO_TOQUE,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: raio.m,
    backgroundColor: cores.primariaSuave,
    paddingHorizontal: 20,
  },
  textoBotao: { fontSize: 16, fontWeight: '700', color: cores.primaria },
});

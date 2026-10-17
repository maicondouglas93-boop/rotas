import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ALVO_TOQUE, cores, espaco } from './tema';

type Variante = 'primaria' | 'secundaria' | 'perigo';

export function Botao({
  titulo,
  onPress,
  variante = 'primaria',
  desabilitado = false,
  carregando = false,
}: {
  titulo: string;
  onPress: () => void;
  variante?: Variante;
  desabilitado?: boolean;
  carregando?: boolean;
}) {
  const inativo = desabilitado || carregando;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: carregando }}
      onPress={onPress}
      disabled={inativo}
      style={({ pressed }) => [estilos.botao, estilos[variante], inativo && estilos.inativo, pressed && estilos.pressionado]}
    >
      {carregando ? (
        <ActivityIndicator color={variante === 'secundaria' ? cores.primaria : cores.primariaTexto} />
      ) : (
        <Text style={[estilos.textoBotao, variante === 'secundaria' && estilos.textoSecundario]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

export function Campo({ rotulo, erro, ...props }: TextInputProps & { rotulo: string; erro?: string }) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={cores.textoSecundario}
        style={[estilos.entrada, erro ? estilos.entradaErro : null]}
        {...props}
      />
      {erro ? (
        <Text accessibilityRole="alert" style={estilos.erro}>
          {erro}
        </Text>
      ) : null}
    </View>
  );
}

/** Tela com rolagem, margem e área segura; aceita "puxar para atualizar". */
export function Tela({
  children,
  refreshControl,
  rodape,
}: {
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  rodape?: ReactNode;
}) {
  return (
    <SafeAreaView style={estilos.tela} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={estilos.conteudo} refreshControl={refreshControl} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {rodape ? <View style={estilos.rodape}>{rodape}</View> : null}
    </SafeAreaView>
  );
}

export function Cartao({ children }: { children: ReactNode }) {
  return <View style={estilos.cartao}>{children}</View>;
}

export function Aviso({ texto, tom = 'alerta' }: { texto: string; tom?: 'alerta' | 'info' | 'perigo' }) {
  const fundo = tom === 'info' ? cores.infoFundo : tom === 'perigo' ? '#fee2e2' : cores.alertaFundo;
  const cor = tom === 'info' ? cores.info : tom === 'perigo' ? cores.perigo : cores.alerta;
  return (
    <View accessibilityRole="alert" style={[estilos.aviso, { backgroundColor: fundo }]}>
      <Text style={[estilos.textoAviso, { color: cor }]}>{texto}</Text>
    </View>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <View style={estilos.carregando}>
      <ActivityIndicator color={cores.primaria} />
      <Text style={estilos.textoSecundarioPadrao}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: ALVO_TOQUE + 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espaco.g,
  },
  primaria: { backgroundColor: cores.primaria },
  secundaria: { backgroundColor: cores.superficie, borderWidth: 1.5, borderColor: cores.primaria },
  perigo: { backgroundColor: cores.perigo },
  inativo: { opacity: 0.5 },
  pressionado: { opacity: 0.85 },
  textoBotao: { fontSize: 17, fontWeight: '700', color: cores.primariaTexto },
  textoSecundario: { color: cores.primaria },
  campo: { gap: 6 },
  rotulo: { fontSize: 16, fontWeight: '600', color: cores.texto },
  entrada: {
    minHeight: ALVO_TOQUE,
    borderWidth: 1.5,
    borderColor: cores.borda,
    borderRadius: 10,
    paddingHorizontal: espaco.m,
    fontSize: 17,
    color: cores.texto,
    backgroundColor: cores.superficie,
  },
  entradaErro: { borderColor: cores.perigo },
  erro: { color: cores.perigo, fontSize: 15 },
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.g, gap: espaco.m, paddingBottom: espaco.gg },
  rodape: {
    padding: espaco.g,
    gap: espaco.p,
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.g,
    gap: espaco.p,
  },
  aviso: { borderRadius: 10, padding: espaco.m },
  textoAviso: { fontSize: 15, fontWeight: '600' },
  carregando: { alignItems: 'center', gap: espaco.p, padding: espaco.gg },
  textoSecundarioPadrao: { fontSize: 16, color: cores.textoSecundario },
});

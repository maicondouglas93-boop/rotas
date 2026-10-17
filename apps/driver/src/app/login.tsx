import { ErroApi } from '@rotas/shared';
import { Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aviso, Botao, Campo, Tela } from '../componentes/basicos';
import { Icone } from '../componentes/icone';
import { StatusApi } from '../componentes/status-api';
import { ALVO_TOQUE, cores, espaco, GRADIENTE_MARCA, raio, sombra } from '../componentes/tema';
import { useSessao } from '../sessao/sessao';

export default function Login() {
  const { estado, entrar } = useSessao();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (estado.situacao === 'autenticado') return <Redirect href="/" />;

  async function enviar() {
    setErro(null);
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.');
      return;
    }
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível entrar. Tente novamente.');
      setSenha('');
    } finally {
      setEnviando(false);
    }
  }

  const topo = (
    <LinearGradient
      colors={GRADIENTE_MARCA}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[estilos.hero, { paddingTop: insets.top + espaco.ggg + espaco.p }]}
    >
      <View style={estilos.marca}>
        <Icone nome="truck-fast-outline" tamanho={34} cor={cores.primariaTexto} />
      </View>
      <Text style={estilos.nomeApp}>Rotas</Text>
      <Text style={estilos.slogan}>Suas coletas e entregas do dia, parada a parada.</Text>
    </LinearGradient>
  );

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior="height">
      <StatusBar style="light" />
      <Tela topo={topo}>
        <View style={[estilos.formulario, sombra.elevada]}>
          <View style={estilos.cabecalho}>
            <Text accessibilityRole="header" style={estilos.titulo}>
              Entrar
            </Text>
            <Text style={estilos.subtitulo}>Use o e-mail e a senha que a administração passou.</Text>
          </View>
          {estado.situacao === 'anonimo' && estado.motivo ? <Aviso texto={estado.motivo} /> : null}
          <Campo
            rotulo="E-mail"
            icone="email-outline"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
          />
          <Campo
            rotulo="Senha"
            icone="lock-outline"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry={!mostrarSenha}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={enviar}
            direita={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                onPress={() => setMostrarSenha((v) => !v)}
                style={estilos.olho}
              >
                <Icone nome={mostrarSenha ? 'eye-off-outline' : 'eye-outline'} cor={cores.textoSecundario} />
              </Pressable>
            }
          />
          {erro ? <Aviso tom="perigo" texto={erro} /> : null}
          <Botao titulo="Entrar" icone="login" onPress={enviar} carregando={enviando} />
        </View>
        <View style={estilos.status}>
          <StatusApi />
        </View>
      </Tela>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  hero: {
    paddingHorizontal: espaco.gg,
    paddingBottom: 72,
    gap: espaco.p,
    borderBottomLeftRadius: raio.gg + 6,
    borderBottomRightRadius: raio.gg + 6,
  },
  marca: {
    width: 64,
    height: 64,
    borderRadius: raio.g + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    marginBottom: espaco.p,
  },
  nomeApp: { fontSize: 36, fontWeight: '800', color: cores.primariaTexto, letterSpacing: -0.8 },
  slogan: { fontSize: 17, color: 'rgba(255, 255, 255, 0.82)', lineHeight: 24 },
  formulario: {
    marginTop: -52,
    backgroundColor: cores.superficie,
    borderRadius: raio.gg,
    padding: espaco.gg - 4,
    gap: espaco.g,
  },
  cabecalho: { gap: 4 },
  titulo: { fontSize: 24, fontWeight: '800', color: cores.texto, letterSpacing: -0.3 },
  subtitulo: { fontSize: 16, color: cores.textoSecundario, lineHeight: 22 },
  olho: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', marginRight: -espaco.p },
  status: { marginTop: espaco.p },
});

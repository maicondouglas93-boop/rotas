import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native';
import { Aviso, Botao, Campo, Tela } from '../componentes/basicos';
import { StatusApi } from '../componentes/status-api';
import { cores } from '../componentes/tema';
import { useSessao } from '../sessao/sessao';
import { ErroApi } from '@rotas/shared';

export default function Login() {
  const { estado, entrar } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
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

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior="height">
      <Tela>
        <View style={estilos.cabecalho}>
          <Text style={estilos.titulo}>Rotas · Motorista</Text>
          <Text style={estilos.subtitulo}>Entre com o e-mail e a senha que a administração passou.</Text>
        </View>
        {estado.situacao === 'anonimo' && estado.motivo ? <Aviso texto={estado.motivo} /> : null}
        <Campo
          rotulo="E-mail"
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
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={enviar}
        />
        {erro ? <Aviso tom="perigo" texto={erro} /> : null}
        <Botao titulo="Entrar" onPress={enviar} carregando={enviando} />
        <View style={estilos.status}>
          <StatusApi />
        </View>
      </Tela>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  cabecalho: { gap: 6, marginTop: 48, marginBottom: 8 },
  titulo: { fontSize: 26, fontWeight: '800', color: cores.texto },
  subtitulo: { fontSize: 16, color: cores.textoSecundario },
  status: { marginTop: 16 },
});

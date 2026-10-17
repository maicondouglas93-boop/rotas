import { ErroApi } from '@rotas/shared';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Aviso, Botao, Campo, Cartao, Tela } from '../componentes/basicos';
import { Icone } from '../componentes/icone';
import { cores, raio } from '../componentes/tema';
import { useSessao } from '../sessao/sessao';

export default function TrocarSenha() {
  const { estado, trocarSenha, sair } = useSessao();
  const router = useRouter();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (estado.situacao === 'anonimo') return <Redirect href="/login" />;

  async function enviar() {
    setErro(null);
    if (novaSenha.length < 8) return setErro('A nova senha precisa de ao menos 8 caracteres.');
    if (novaSenha !== confirmacao) return setErro('As senhas não conferem.');
    setEnviando(true);
    try {
      await trocarSenha(senhaAtual, novaSenha);
      router.replace('/');
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível trocar a senha.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <Cartao>
        <View style={estilos.icone}>
          <Icone nome="shield-lock-outline" tamanho={30} cor={cores.primaria} />
        </View>
        <Text accessibilityRole="header" style={estilos.titulo}>
          Crie sua senha
        </Text>
        <Text style={estilos.texto}>Por segurança, troque a senha temporária antes de começar.</Text>
      </Cartao>
      <Campo
        rotulo="Senha atual (temporária)"
        icone="lock-clock"
        value={senhaAtual}
        onChangeText={setSenhaAtual}
        secureTextEntry
        autoCapitalize="none"
      />
      <Campo rotulo="Nova senha" icone="lock-outline" value={novaSenha} onChangeText={setNovaSenha} secureTextEntry autoCapitalize="none" />
      <Campo
        rotulo="Repita a nova senha"
        icone="lock-check-outline"
        value={confirmacao}
        onChangeText={setConfirmacao}
        secureTextEntry
        autoCapitalize="none"
      />
      <Aviso tom="info" texto="Mínimo de 8 caracteres. Evite senhas comuns e o seu e-mail." />
      {erro ? <Aviso tom="perigo" texto={erro} /> : null}
      <Botao titulo="Salvar nova senha" icone="check" onPress={enviar} carregando={enviando} />
      <Botao titulo="Sair" icone="logout" variante="secundaria" onPress={() => void sair()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  icone: {
    width: 56,
    height: 56,
    borderRadius: raio.g,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.primariaSuave,
    marginBottom: 4,
  },
  titulo: { fontSize: 22, fontWeight: '800', color: cores.texto, letterSpacing: -0.3 },
  texto: { fontSize: 16, color: cores.textoSecundario, lineHeight: 22 },
});

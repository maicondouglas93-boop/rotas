import { ErroApi } from '@rotas/shared';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Aviso, Botao, Campo, Tela } from '../componentes/basicos';
import { cores } from '../componentes/tema';
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
      <Text style={estilos.texto}>Por segurança, troque a senha temporária antes de começar.</Text>
      <Campo rotulo="Senha atual (temporária)" value={senhaAtual} onChangeText={setSenhaAtual} secureTextEntry autoCapitalize="none" />
      <Campo rotulo="Nova senha" value={novaSenha} onChangeText={setNovaSenha} secureTextEntry autoCapitalize="none" />
      <Campo rotulo="Repita a nova senha" value={confirmacao} onChangeText={setConfirmacao} secureTextEntry autoCapitalize="none" />
      <Text style={estilos.dica}>Mínimo de 8 caracteres. Evite senhas comuns e o seu e-mail.</Text>
      {erro ? <Aviso tom="perigo" texto={erro} /> : null}
      <Botao titulo="Salvar nova senha" onPress={enviar} carregando={enviando} />
      <Botao titulo="Sair" variante="secundaria" onPress={() => void sair()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  texto: { fontSize: 17, color: cores.texto },
  dica: { fontSize: 15, color: cores.textoSecundario },
});

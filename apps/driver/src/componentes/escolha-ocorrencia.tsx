import { ROTULO_TIPO_OCORRENCIA, TipoOcorrencia } from '@rotas/shared';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aviso, Botao, Campo } from './basicos';
import { ALVO_TOQUE, cores } from './tema';

/** Escolha do motivo em botões grandes; descrição só é obrigatória em "Outro" (mínimo 10 caracteres). */
export function EscolhaOcorrencia({
  visivel,
  titulo,
  rotuloConfirmar,
  onCancelar,
  onConfirmar,
}: {
  visivel: boolean;
  titulo: string;
  rotuloConfirmar: string;
  onCancelar: () => void;
  onConfirmar: (tipo: TipoOcorrencia, descricao?: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoOcorrencia | null>(null);
  const [descricao, setDescricao] = useState('');
  const precisaDescricao = tipo === TipoOcorrencia.OUTRO;
  const pronto = tipo !== null && (!precisaDescricao || descricao.trim().length >= 10);

  function fechar() {
    setTipo(null);
    setDescricao('');
    onCancelar();
  }

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={fechar}>
      <SafeAreaView style={estilos.tela}>
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          <Text style={estilos.titulo}>{titulo}</Text>
          {Object.values(TipoOcorrencia).map((opcao) => {
            const marcado = tipo === opcao;
            return (
              <Pressable
                key={opcao}
                accessibilityRole="radio"
                accessibilityState={{ checked: marcado }}
                onPress={() => setTipo(opcao)}
                style={[estilos.opcao, marcado && estilos.opcaoMarcada]}
              >
                <Text style={[estilos.textoOpcao, marcado && estilos.textoMarcado]}>{ROTULO_TIPO_OCORRENCIA[opcao]}</Text>
              </Pressable>
            );
          })}
          {precisaDescricao ? (
            <Campo rotulo="Descreva o que aconteceu" value={descricao} onChangeText={setDescricao} multiline maxLength={500} />
          ) : null}
          {precisaDescricao && descricao.trim().length > 0 && descricao.trim().length < 10 ? (
            <Aviso texto="Escreva ao menos 10 caracteres." />
          ) : null}
        </ScrollView>
        <View style={estilos.rodape}>
          <Botao
            titulo={rotuloConfirmar}
            variante="perigo"
            desabilitado={!pronto}
            onPress={() => {
              if (!tipo) return;
              onConfirmar(tipo, descricao.trim() || undefined);
              setTipo(null);
              setDescricao('');
            }}
          />
          <Botao titulo="Voltar" variante="secundaria" onPress={fechar} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 16, gap: 10 },
  titulo: { fontSize: 22, fontWeight: '800', color: cores.texto, marginBottom: 4 },
  opcao: {
    minHeight: ALVO_TOQUE + 4,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
    paddingHorizontal: 16,
  },
  opcaoMarcada: { borderColor: cores.primaria, backgroundColor: cores.infoFundo },
  textoOpcao: { fontSize: 17, color: cores.texto },
  textoMarcado: { fontWeight: '700', color: cores.primaria },
  rodape: { padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: cores.borda, backgroundColor: cores.superficie },
});

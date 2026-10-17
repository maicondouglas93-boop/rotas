import { ROTULO_TIPO_OCORRENCIA, TipoOcorrencia } from '@rotas/shared';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aviso, Botao, BotaoIcone, Campo } from './basicos';
import { Icone, type NomeIcone } from './icone';
import { ALVO_TOQUE, cores, espaco, raio } from './tema';

const ICONE_OCORRENCIA: Record<TipoOcorrencia, NomeIcone> = {
  ENDERECO_INCORRETO: 'map-marker-question-outline',
  EMPRESA_FECHADA: 'store-remove-outline',
  CLIENTE_AUSENTE: 'account-off-outline',
  RECUSA_RECEBIMENTO: 'hand-back-left-outline',
  MERCADORIA_INDISPONIVEL: 'package-variant-remove',
  ENTREGA_NAO_REALIZADA: 'truck-remove-outline',
  OUTRO: 'dots-horizontal-circle-outline',
};

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
        <View style={estilos.cabecalho}>
          <Text accessibilityRole="header" style={estilos.titulo}>
            {titulo}
          </Text>
          <BotaoIcone icone="close" rotulo="Fechar" onPress={fechar} />
        </View>
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          {Object.values(TipoOcorrencia).map((opcao) => {
            const marcado = tipo === opcao;
            return (
              <Pressable
                key={opcao}
                accessibilityRole="radio"
                accessibilityLabel={ROTULO_TIPO_OCORRENCIA[opcao]}
                accessibilityState={{ checked: marcado }}
                onPress={() => setTipo(opcao)}
                style={({ pressed }) => [estilos.opcao, marcado && estilos.opcaoMarcada, pressed && { opacity: 0.9 }]}
              >
                <View style={[estilos.iconeOpcao, marcado && estilos.iconeOpcaoMarcado]}>
                  <Icone nome={ICONE_OCORRENCIA[opcao]} cor={marcado ? cores.primariaTexto : cores.primaria} />
                </View>
                <Text style={[estilos.textoOpcao, marcado && estilos.textoMarcado]}>{ROTULO_TIPO_OCORRENCIA[opcao]}</Text>
                <Icone
                  nome={marcado ? 'check-circle' : 'checkbox-blank-circle-outline'}
                  cor={marcado ? cores.primaria : cores.bordaForte}
                  tamanho={24}
                />
              </Pressable>
            );
          })}
          {precisaDescricao ? (
            <Campo
              rotulo="Descreva o que aconteceu"
              value={descricao}
              onChangeText={setDescricao}
              multiline
              maxLength={500}
              placeholder="Ex.: portão fechado, ninguém atendeu o interfone"
            />
          ) : null}
          {precisaDescricao && descricao.trim().length > 0 && descricao.trim().length < 10 ? (
            <Aviso texto="Escreva ao menos 10 caracteres." />
          ) : null}
        </ScrollView>
        <View style={estilos.rodape}>
          <Botao
            titulo={rotuloConfirmar}
            variante="perigo"
            icone="alert-circle-outline"
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
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.g,
    paddingTop: espaco.m,
    paddingBottom: espaco.p,
  },
  titulo: { flex: 1, fontSize: 24, fontWeight: '800', color: cores.texto, letterSpacing: -0.3 },
  conteudo: { padding: espaco.g, paddingTop: espaco.p, gap: espaco.p + 2 },
  opcao: {
    minHeight: ALVO_TOQUE + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    borderRadius: raio.g,
    borderWidth: 1.5,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
    paddingHorizontal: espaco.m + 2,
  },
  opcaoMarcada: { borderColor: cores.primaria, backgroundColor: cores.primariaSuave },
  iconeOpcao: {
    width: 40,
    height: 40,
    borderRadius: raio.m,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.primariaSuave,
  },
  iconeOpcaoMarcado: { backgroundColor: cores.primaria },
  textoOpcao: { flex: 1, fontSize: 17, fontWeight: '600', color: cores.texto },
  textoMarcado: { fontWeight: '800', color: cores.primaria },
  rodape: {
    padding: espaco.g,
    gap: espaco.p,
    backgroundColor: cores.superficie,
    boxShadow: '0px -6px 18px rgba(16, 24, 40, 0.07)',
  },
});

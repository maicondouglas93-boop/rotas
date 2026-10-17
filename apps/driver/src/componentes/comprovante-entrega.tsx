import { LIMITE_FOTO_COMPROVANTE_BYTES, type Assinatura, type ComprovanteEntrada } from '@rotas/shared';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AreaAssinatura } from './area-assinatura';
import { Aviso, Botao, BotaoIcone, Campo, TituloSecao } from './basicos';
import { cores, espaco, raio } from './tema';

/** Maior lado da foto depois de reduzida (suficiente para ler etiqueta e conferir o volume). */
const LADO_MAXIMO = 1280;

interface Foto {
  uri: string;
  base64: string;
}

/**
 * Reduz e reencoda a foto em JPEG no aparelho: some o EXIF (inclusive o GPS) e o arquivo fica
 * pequeno o bastante para a fila offline e para o envio (auth-security-lgpd).
 */
async function prepararFoto(asset: ImagePicker.ImagePickerAsset): Promise<Foto> {
  const contexto = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > LADO_MAXIMO) {
    contexto.resize(asset.width >= asset.height ? { width: LADO_MAXIMO } : { height: LADO_MAXIMO });
  }
  const imagem = await contexto.renderAsync();
  for (const compress of [0.6, 0.4, 0.25]) {
    const salva = await imagem.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    if (salva.base64 && (salva.base64.length * 3) / 4 <= LIMITE_FOTO_COMPROVANTE_BYTES) {
      return { uri: salva.uri, base64: salva.base64 };
    }
  }
  throw new Error('Foto grande demais mesmo reduzida.');
}

/** Tela do comprovante ao concluir a entrega: foto, assinatura e nome, todos opcionais. */
export function ComprovanteEntrega({
  visivel,
  empresa,
  onCancelar,
  onConfirmar,
}: {
  visivel: boolean;
  empresa: string;
  onCancelar: () => void;
  onConfirmar: (comprovante: ComprovanteEntrada | undefined) => void;
}) {
  const [foto, setFoto] = useState<Foto | null>(null);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [nome, setNome] = useState('');
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [desenhando, setDesenhando] = useState(false);
  const [versaoAssinatura, setVersaoAssinatura] = useState(0);

  const aoMudarAssinatura = useCallback((nova: Assinatura | null) => setAssinatura(nova), []);
  const aoDesenhar = useCallback((sim: boolean) => setDesenhando(sim), []);

  function limparTudo() {
    setFoto(null);
    setAssinatura(null);
    setNome('');
    setVersaoAssinatura((v) => v + 1);
  }

  function fechar() {
    limparTudo();
    onCancelar();
  }

  // Câmera só é pedida aqui, na hora de fotografar (react-native-driver-app).
  async function fotografar() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Câmera não liberada', 'Permita o uso da câmera nas configurações do aparelho para fotografar o comprovante.');
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
    const asset = resultado.canceled ? undefined : resultado.assets[0];
    if (!asset) return;
    setPreparandoFoto(true);
    try {
      setFoto(await prepararFoto(asset));
    } catch {
      Alert.alert('Não foi possível usar a foto', 'Tente fotografar de novo.');
    } finally {
      setPreparandoFoto(false);
    }
  }

  function concluir() {
    const nomeLimpo = nome.trim();
    const comprovante: ComprovanteEntrada = {
      ...(foto ? { fotoJpegBase64: foto.base64 } : {}),
      ...(assinatura && assinatura.tracos.length > 0 ? { assinatura } : {}),
      ...(nomeLimpo.length >= 2 ? { nomeRecebedor: nomeLimpo } : {}),
    };
    onConfirmar(Object.keys(comprovante).length > 0 ? comprovante : undefined);
    limparTudo();
  }

  const vazio = !foto && !assinatura && nome.trim().length < 2;

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={fechar}>
      <SafeAreaView style={estilos.tela}>
        <View style={estilos.cabecalho}>
          <View style={estilos.titulos}>
            <Text accessibilityRole="header" style={estilos.titulo}>
              Comprovante de entrega
            </Text>
            <Text style={estilos.subtitulo}>{empresa}</Text>
          </View>
          <BotaoIcone icone="close" rotulo="Fechar" onPress={fechar} />
        </View>
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" scrollEnabled={!desenhando}>
          <TituloSecao texto="Foto da entrega" />
          {foto ? (
            <View style={estilos.fotoBloco}>
              <Image source={{ uri: foto.uri }} style={estilos.foto} accessibilityLabel="Foto do comprovante" />
              <View style={estilos.linhaBotoes}>
                <View style={estilos.metade}>
                  <Botao titulo="Tirar outra" icone="camera-retake-outline" variante="suave" onPress={() => void fotografar()} />
                </View>
                <View style={estilos.metade}>
                  <Botao titulo="Remover" icone="delete-outline" variante="secundaria" onPress={() => setFoto(null)} />
                </View>
              </View>
            </View>
          ) : (
            <Botao
              titulo="Tirar foto"
              icone="camera-outline"
              variante="suave"
              carregando={preparandoFoto}
              onPress={() => void fotografar()}
            />
          )}

          <TituloSecao texto="Assinatura de quem recebeu" />
          <AreaAssinatura key={versaoAssinatura} onMudar={aoMudarAssinatura} onDesenhando={aoDesenhar} />

          <Campo
            rotulo="Nome de quem recebeu"
            icone="account-outline"
            value={nome}
            onChangeText={setNome}
            maxLength={120}
            autoCapitalize="words"
            placeholder="Opcional"
          />
          {vazio ? (
            <Aviso tom="info" texto="Sempre que puder, registre a foto ou a assinatura: elas comprovam a entrega para a administração." />
          ) : null}
        </ScrollView>
        <View style={estilos.rodape}>
          <Botao titulo="Concluir entrega" icone="check-circle-outline" onPress={concluir} desabilitado={preparandoFoto} />
          <Text style={estilos.nota}>Esta confirmação não pode ser desfeita pelo app.</Text>
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
  titulos: { flex: 1, gap: 2 },
  titulo: { fontSize: 24, fontWeight: '800', color: cores.texto, letterSpacing: -0.3 },
  subtitulo: { fontSize: 16, color: cores.textoSecundario },
  conteudo: { padding: espaco.g, paddingTop: espaco.p, gap: espaco.m },
  fotoBloco: { gap: espaco.p },
  foto: { width: '100%', aspectRatio: 4 / 3, borderRadius: raio.m, backgroundColor: cores.neutroFundo },
  linhaBotoes: { flexDirection: 'row', gap: espaco.p },
  metade: { flex: 1 },
  rodape: {
    padding: espaco.g,
    gap: espaco.p,
    backgroundColor: cores.superficie,
    boxShadow: '0px -6px 18px rgba(16, 24, 40, 0.07)',
  },
  nota: { fontSize: 14, color: cores.textoSecundario, textAlign: 'center' },
});

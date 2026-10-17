import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dispensarAviso, useAvisoAdministracao } from '../api/avisos';
import { useOnline } from '../api/conexao';
import { useFilaPendente } from '../api/consultas';
import { Aviso } from './basicos';
import { Icone } from './icone';
import { ALVO_TOQUE, cores, espaco, raio } from './tema';

/** Aviso de mudança feita pela administração (chega pelo tempo real). Toque para dispensar. */
function AvisoAdministracao() {
  const aviso = useAvisoAdministracao();
  if (!aviso) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${aviso} Toque para dispensar.`}
      accessibilityLiveRegion="polite"
      onPress={dispensarAviso}
      style={({ pressed }) => [estilos.aviso, pressed && { opacity: 0.9 }]}
    >
      <Icone nome="bell-ring-outline" cor={cores.primariaTexto} />
      <Text style={estilos.texto}>{aviso}</Text>
      <View style={estilos.fechar}>
        <Icone nome="close" tamanho={20} cor={cores.primariaTexto} />
      </View>
    </Pressable>
  );
}

/** "Sem conexão — 2 ações aguardando envio" e avisos da administração. Some quando não há nada. */
export function BannerConexao() {
  const online = useOnline();
  const pendentes = useFilaPendente().length;
  const acoes = pendentes === 1 ? '1 ação aguardando envio' : `${pendentes} ações aguardando envio`;
  return (
    <>
      <AvisoAdministracao />
      {!online ? (
        <Aviso
          icone="cloud-off-outline"
          texto={pendentes > 0 ? `Sem conexão — ${acoes}.` : 'Sem conexão. Mostrando os dados salvos.'}
        />
      ) : pendentes > 0 ? (
        <Aviso tom="info" icone="cloud-upload-outline" texto={`Enviando: ${acoes}…`} />
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    minHeight: ALVO_TOQUE + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: raio.m,
    paddingLeft: espaco.m + 2,
    paddingVertical: espaco.p,
    backgroundColor: cores.primaria,
  },
  texto: { flex: 1, fontSize: 15, fontWeight: '700', color: cores.primariaTexto, lineHeight: 21 },
  fechar: { width: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' },
});

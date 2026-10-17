import { caminhoAssinaturaSvg, type Assinatura } from '@rotas/shared';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { adicionarPonto, novoTraco } from './assinatura-dados';
import { Botao } from './basicos';
import { cores, raio } from './tema';

/**
 * Área para o recebedor assinar com o dedo. Guarda só os traços (vetor), sem imagem.
 * `onDesenhando` avisa a tela para travar a rolagem enquanto o dedo está na área.
 */
export function AreaAssinatura({
  onMudar,
  onDesenhando,
}: {
  onMudar: (assinatura: Assinatura | null) => void;
  onDesenhando?: (desenhando: boolean) => void;
}) {
  const [tracos, setTracos] = useState<number[][]>([]);
  const tamanho = useRef({ largura: 0, altura: 0 });
  const tracosRef = useRef<number[][]>([]);

  const atualizar = (novos: number[][]) => {
    tracosRef.current = novos;
    setTracos(novos);
  };

  // Props de toque da própria View (sistema de responder do React Native): só rodam nos eventos.
  const toque = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      onDesenhando?.(true);
      const { largura, altura } = tamanho.current;
      atualizar([...tracosRef.current, novoTraco(e.nativeEvent.locationX, e.nativeEvent.locationY, largura, altura)]);
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const { largura, altura } = tamanho.current;
      const atuais = tracosRef.current;
      const ultimo = atuais[atuais.length - 1];
      if (!ultimo) return;
      const novo = adicionarPonto(ultimo, e.nativeEvent.locationX, e.nativeEvent.locationY, largura, altura);
      if (novo !== ultimo) atualizar([...atuais.slice(0, -1), novo]);
    },
    onResponderRelease: () => {
      onDesenhando?.(false);
      const { largura, altura } = tamanho.current;
      onMudar({ largura: Math.round(largura), altura: Math.round(altura), tracos: tracosRef.current });
    },
    onResponderTerminate: () => onDesenhando?.(false),
  };

  function limpar() {
    atualizar([]);
    onMudar(null);
  }

  return (
    <View style={estilos.bloco}>
      <View
        style={estilos.area}
        accessibilityLabel="Área para assinar com o dedo"
        onLayout={(e: LayoutChangeEvent) => {
          tamanho.current = { largura: e.nativeEvent.layout.width, altura: e.nativeEvent.layout.height };
        }}
        {...toque}
      >
        <Svg width="100%" height="100%">
          {tracos.map((traco, i) => (
            <Path
              key={i}
              d={caminhoAssinaturaSvg(traco)}
              stroke={cores.texto}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
        {tracos.length === 0 ? (
          <Text pointerEvents="none" style={estilos.dica}>
            Assine aqui com o dedo
          </Text>
        ) : null}
        <View pointerEvents="none" style={estilos.linha} />
      </View>
      {tracos.length > 0 ? <Botao titulo="Limpar assinatura" icone="eraser" variante="suave" onPress={limpar} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: 8 },
  area: {
    height: 180,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.bordaForte,
    borderStyle: 'dashed',
    backgroundColor: cores.superficie,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dica: { position: 'absolute', fontSize: 16, color: cores.textoSecundario },
  linha: { position: 'absolute', left: 24, right: 24, bottom: 36, height: 1, backgroundColor: cores.borda },
});

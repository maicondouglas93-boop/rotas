import { ROTULO_TIPO_SERVICO, type TipoServico } from '@rotas/shared';
import { StyleSheet, Text, View } from 'react-native';
import { Icone, type NomeIcone } from './icone';
import { cores, raio } from './tema';

export const ICONE_SERVICO: Record<TipoServico, NomeIcone> = {
  COLETA: 'package-variant-closed',
  ENTREGA: 'truck-delivery-outline',
};

/** Etiqueta compacta do tipo de serviço (lista de paradas). */
export function ChipServico({ tipo }: { tipo: TipoServico }) {
  return (
    <View style={estilos.chip}>
      <Icone nome={ICONE_SERVICO[tipo]} tamanho={16} cor={cores.primaria} />
      <Text style={estilos.texto}>{ROTULO_TIPO_SERVICO[tipo]}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: raio.pilula,
    backgroundColor: cores.primariaSuave,
  },
  texto: { fontSize: 14, fontWeight: '700', color: cores.primaria },
});

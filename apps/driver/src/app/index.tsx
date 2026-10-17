import { StyleSheet, Text, View } from 'react-native';
import { StatusApi } from '../componentes/status-api';

export default function Inicio() {
  return (
    <View style={estilos.tela}>
      <Text style={estilos.titulo}>Rotas do motorista</Text>
      <Text style={estilos.descricao}>
        Aqui aparecerão as rotas enviadas pela administração.
      </Text>
      <View style={estilos.cartao}>
        <StatusApi />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, padding: 16, gap: 12, backgroundColor: '#f9fafb' },
  titulo: { fontSize: 22, fontWeight: '600', color: '#111827' },
  descricao: { fontSize: 16, color: '#4b5563' },
  cartao: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#ffffff',
  },
});

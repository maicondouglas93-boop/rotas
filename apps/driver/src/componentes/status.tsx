import {
  ROTULO_STATUS_PARADA,
  ROTULO_STATUS_ROTA,
  ROTULO_STATUS_SERVICO,
  type StatusParada,
  type StatusRota,
  type StatusServico,
} from '@rotas/shared';
import { StyleSheet, Text, View } from 'react-native';
import { Icone } from './icone';
import { cores, raio } from './tema';

export type Tom = 'neutro' | 'info' | 'alerta' | 'sucesso' | 'perigo';

export const TONS: Record<Tom, { fundo: string; texto: string }> = {
  neutro: { fundo: cores.neutroFundo, texto: cores.neutro },
  info: { fundo: cores.infoFundo, texto: cores.info },
  alerta: { fundo: cores.alertaFundo, texto: cores.alerta },
  sucesso: { fundo: cores.sucessoFundo, texto: cores.sucesso },
  perigo: { fundo: cores.perigoFundo, texto: cores.perigo },
};

const TOM_ROTA: Record<StatusRota, Tom> = {
  RASCUNHO: 'neutro',
  ENVIADA: 'info',
  RECEBIDA: 'info',
  EM_ANDAMENTO: 'alerta',
  CONCLUIDA: 'sucesso',
  CANCELADA: 'perigo',
};
const TOM_PARADA: Record<StatusParada, Tom> = {
  PENDENTE: 'neutro',
  A_CAMINHO: 'info',
  NO_LOCAL: 'alerta',
  FINALIZADA: 'sucesso',
  CANCELADA: 'neutro',
};
const TOM_SERVICO: Record<StatusServico, Tom> = {
  PENDENTE: 'neutro',
  REALIZADO: 'sucesso',
  NAO_REALIZADO: 'perigo',
  CANCELADO: 'neutro',
};

type Props =
  | { tipo: 'rota'; status: StatusRota }
  | { tipo: 'parada'; status: StatusParada }
  | { tipo: 'servico'; status: StatusServico };

/** Selo de status: ponto colorido + texto (a cor nunca é a única informação). */
export function Status(props: Props) {
  const [rotulo, tom] =
    props.tipo === 'rota'
      ? [ROTULO_STATUS_ROTA[props.status], TOM_ROTA[props.status]]
      : props.tipo === 'parada'
        ? [ROTULO_STATUS_PARADA[props.status], TOM_PARADA[props.status]]
        : [ROTULO_STATUS_SERVICO[props.status], TOM_SERVICO[props.status]];
  const { fundo, texto } = TONS[tom];
  return (
    <View style={[estilos.selo, { backgroundColor: fundo }]}>
      <View style={[estilos.ponto, { backgroundColor: texto }]} />
      <Text style={[estilos.texto, { color: texto }]}>{rotulo}</Text>
    </View>
  );
}

/** Marca de item com ação feita no aparelho e ainda não confirmada pelo servidor. */
export function AguardandoEnvio() {
  return (
    <View style={estilos.aguardando}>
      <Icone nome="cloud-upload-outline" tamanho={16} cor={cores.info} />
      <Text style={estilos.textoAguardando}>Aguardando envio</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  selo: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: raio.pilula,
  },
  ponto: { width: 7, height: 7, borderRadius: raio.pilula },
  texto: { fontSize: 14, fontWeight: '700' },
  aguardando: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  textoAguardando: { fontSize: 14, fontWeight: '700', color: cores.info },
});

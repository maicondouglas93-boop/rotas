import {
  ROTULO_STATUS_PARADA,
  ROTULO_STATUS_ROTA,
  ROTULO_STATUS_SERVICO,
  type StatusParada,
  type StatusRota,
  type StatusServico,
} from '@rotas/shared';
import { StyleSheet, Text } from 'react-native';
import { cores } from './tema';

type Tom = 'neutro' | 'info' | 'alerta' | 'sucesso' | 'perigo';

const TONS: Record<Tom, { fundo: string; texto: string }> = {
  neutro: { fundo: cores.neutroFundo, texto: cores.texto },
  info: { fundo: cores.infoFundo, texto: cores.info },
  alerta: { fundo: cores.alertaFundo, texto: cores.alerta },
  sucesso: { fundo: '#d1fae5', texto: cores.sucesso },
  perigo: { fundo: '#fee2e2', texto: cores.perigo },
};

const TOM_ROTA: Record<StatusRota, Tom> = {
  RASCUNHO: 'neutro',
  ENVIADA: 'info',
  RECEBIDA: 'info',
  EM_ANDAMENTO: 'alerta',
  CONCLUIDA: 'sucesso',
  CANCELADA: 'neutro',
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

export function Status(props: Props) {
  const [rotulo, tom] =
    props.tipo === 'rota'
      ? [ROTULO_STATUS_ROTA[props.status], TOM_ROTA[props.status]]
      : props.tipo === 'parada'
        ? [ROTULO_STATUS_PARADA[props.status], TOM_PARADA[props.status]]
        : [ROTULO_STATUS_SERVICO[props.status], TOM_SERVICO[props.status]];
  const { fundo, texto } = TONS[tom];
  return <Text style={[estilos.status, { backgroundColor: fundo, color: texto }]}>{rotulo}</Text>;
}

const estilos = StyleSheet.create({
  status: {
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
});

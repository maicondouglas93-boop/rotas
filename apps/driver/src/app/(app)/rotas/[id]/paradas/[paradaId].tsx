import {
  acoesMotoristaParada,
  linkGoogleMaps,
  linkWaze,
  linkWhatsApp,
  ROTULO_TIPO_SERVICO,
  type Servico,
  type TipoOcorrencia,
} from '@rotas/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useEnviarComando, useFilaPendente, useRota } from '../../../../../api/consultas';
import { abrirExterno } from '../../../../../componentes/abrir-externo';
import { BannerConexao } from '../../../../../componentes/banner-conexao';
import { Aviso, Botao, Carregando, Cartao, Tela } from '../../../../../componentes/basicos';
import { EscolhaOcorrencia } from '../../../../../componentes/escolha-ocorrencia';
import { Status } from '../../../../../componentes/status';
import { cores } from '../../../../../componentes/tema';

const TEXTO_CONCLUIR: Record<Servico['tipo'], string> = { COLETA: 'Coleta realizada', ENTREGA: 'Entrega concluída' };

type Ocorrencia = { modo: 'nao-realizar'; servico: Servico } | { modo: 'informativa' } | null;

export default function TelaParada() {
  const { id, paradaId } = useLocalSearchParams<{ id: string; paradaId: string }>();
  const router = useRouter();
  const consulta = useRota(id);
  const enviarComando = useEnviarComando();
  const pendentes = useFilaPendente();
  const [ocorrencia, setOcorrencia] = useState<Ocorrencia>(null);

  if (consulta.isPending) return <Carregando />;
  const rota = consulta.data;
  const parada = rota?.paradas.find((p) => p.id === paradaId);
  if (!rota || !parada) {
    return (
      <Tela>
        <Aviso tom="perigo" texto="Parada não encontrada. A rota pode ter sido alterada pela administração." />
        <Botao titulo="Voltar para a rota" variante="secundaria" onPress={() => router.back()} />
      </Tela>
    );
  }

  const acoes = acoesMotoristaParada(rota.status, parada.status);
  const ids = new Set([parada.id, ...parada.servicos.map((s) => s.id)]);
  const aguardando = pendentes.some((c) => ids.has(c.alvoId));
  const servicosPendentes = parada.servicos.filter((s) => s.status === 'PENDENTE');
  const base = { rotaId: rota.id };

  const comando = (caminho: string, alvoId: string, descricao: string, corpo?: Record<string, unknown>) =>
    void enviarComando({ ...base, caminho, alvoId, descricao, corpo });

  function navegar() {
    void abrirExterno(linkWaze(parada!), linkGoogleMaps(parada!));
  }

  function seguir() {
    comando(`/motorista/paradas/${parada!.id}/seguir`, parada!.id, `Ir para ${parada!.nomeEmpresa}`);
    Alert.alert('Abrir o Waze?', 'Vamos abrir a navegação até a empresa.', [
      { text: 'Agora não', style: 'cancel' },
      { text: 'Abrir Waze', onPress: navegar },
    ]);
  }

  function concluir(servico: Servico) {
    Alert.alert(`${TEXTO_CONCLUIR[servico.tipo]}?`, `${parada!.nomeEmpresa}. Esta confirmação não pode ser desfeita pelo app.`, [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: () => comando(`/motorista/servicos/${servico.id}/realizar`, servico.id, TEXTO_CONCLUIR[servico.tipo]),
      },
    ]);
  }

  function confirmarOcorrencia(tipo: TipoOcorrencia, descricao?: string) {
    if (ocorrencia?.modo === 'nao-realizar') {
      const servico = ocorrencia.servico;
      comando(`/motorista/servicos/${servico.id}/nao-realizar`, servico.id, `${ROTULO_TIPO_SERVICO[servico.tipo]} não realizada`, {
        tipoOcorrencia: tipo,
        descricao,
      });
    } else {
      comando(`/motorista/paradas/${parada!.id}/ocorrencias`, parada!.id, 'Ocorrência', { tipo, descricao });
    }
    setOcorrencia(null);
  }

  const rodape = aguardando ? (
    <Botao titulo="Aguardando envio…" onPress={() => undefined} desabilitado />
  ) : acoes.seguir ? (
    <Botao titulo="Ir para esta parada" onPress={seguir} />
  ) : acoes.chegar ? (
    <Botao titulo="Cheguei ao local" onPress={() => comando(`/motorista/paradas/${parada.id}/cheguei`, parada.id, 'Cheguei ao local')} />
  ) : acoes.realizarServico ? (
    <>
      {servicosPendentes.map((s) => (
        <Botao key={s.id} titulo={TEXTO_CONCLUIR[s.tipo]} onPress={() => concluir(s)} />
      ))}
    </>
  ) : null;

  return (
    <>
      <Stack.Screen options={{ title: `${parada.sequencia}. ${parada.nomeEmpresa}` }} />
      <Tela rodape={rodape}>
        <BannerConexao />
        <Cartao>
          <Status tipo="parada" status={parada.status} />
          <Text style={estilos.nome}>{parada.nomeEmpresa}</Text>
          <Text style={estilos.endereco}>{parada.enderecoFormatado}</Text>
          {parada.observacoes ? <Aviso texto={`Observação da administração: ${parada.observacoes}`} /> : null}
          <View style={estilos.servicos}>
            {parada.servicos.map((s) => (
              <View key={s.id} style={estilos.servico}>
                <Text style={estilos.tipo}>{ROTULO_TIPO_SERVICO[s.tipo]}</Text>
                <Status tipo="servico" status={s.status} />
              </View>
            ))}
          </View>
        </Cartao>

        <View style={estilos.botoes}>
          <Botao titulo="Abrir no Waze" variante="secundaria" onPress={navegar} />
          <Botao titulo="Abrir no Google Maps" variante="secundaria" onPress={() => void abrirExterno(linkGoogleMaps(parada))} />
          {parada.whatsapp ? (
            <Botao titulo="Conversar no WhatsApp" variante="secundaria" onPress={() => void abrirExterno(linkWhatsApp(parada.whatsapp!))} />
          ) : null}
        </View>

        {!aguardando && acoes.naoRealizarServico && servicosPendentes.length > 0 ? (
          <View style={estilos.botoes}>
            {servicosPendentes.map((s) => (
              <Botao
                key={s.id}
                titulo={`Não foi possível: ${ROTULO_TIPO_SERVICO[s.tipo].toLowerCase()}`}
                variante="secundaria"
                onPress={() => setOcorrencia({ modo: 'nao-realizar', servico: s })}
              />
            ))}
          </View>
        ) : null}
        {!aguardando && acoes.registrarOcorrencia ? (
          <Botao titulo="Registrar ocorrência" variante="secundaria" onPress={() => setOcorrencia({ modo: 'informativa' })} />
        ) : null}
        {!aguardando && acoes.voltarParaFila ? (
          <Botao
            titulo="Voltar esta parada para a fila"
            variante="secundaria"
            onPress={() => comando(`/motorista/paradas/${parada.id}/voltar-para-fila`, parada.id, 'Voltar para a fila')}
          />
        ) : null}
        {rota.status !== 'EM_ANDAMENTO' && parada.status === 'PENDENTE' ? (
          <Aviso tom="info" texto="Inicie a rota para registrar esta parada." />
        ) : null}
      </Tela>

      <EscolhaOcorrencia
        visivel={ocorrencia !== null}
        titulo={
          ocorrencia?.modo === 'nao-realizar'
            ? `Por que a ${ROTULO_TIPO_SERVICO[ocorrencia.servico.tipo].toLowerCase()} não foi feita?`
            : 'O que aconteceu?'
        }
        rotuloConfirmar={ocorrencia?.modo === 'nao-realizar' ? 'Registrar como não realizada' : 'Registrar ocorrência'}
        onCancelar={() => setOcorrencia(null)}
        onConfirmar={confirmarOcorrencia}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  nome: { fontSize: 22, fontWeight: '800', color: cores.texto },
  endereco: { fontSize: 16, color: cores.textoSecundario },
  servicos: { gap: 8, marginTop: 4 },
  servico: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipo: { fontSize: 17, fontWeight: '600', color: cores.texto },
  botoes: { gap: 8 },
});

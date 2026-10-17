import {
  acoesMotoristaParada,
  linkGoogleMaps,
  linkWaze,
  linkWhatsApp,
  ROTULO_TIPO_OCORRENCIA,
  ROTULO_TIPO_SERVICO,
  type ComprovanteEntrada,
  type Servico,
  type TipoOcorrencia,
} from '@rotas/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useEnviarComando, useRotaProjetada } from '../../../../../api/consultas';
import { abrirExterno } from '../../../../../componentes/abrir-externo';
import { BannerConexao } from '../../../../../componentes/banner-conexao';
import {
  Atalho,
  Aviso,
  Botao,
  Carregando,
  Cartao,
  GrupoAcoes,
  LinhaAcao,
  Tela,
  TituloSecao,
} from '../../../../../componentes/basicos';
import { ComprovanteEntrega } from '../../../../../componentes/comprovante-entrega';
import { EscolhaOcorrencia } from '../../../../../componentes/escolha-ocorrencia';
import { formatarHora } from '../../../../../componentes/formatos';
import { Icone } from '../../../../../componentes/icone';
import { ICONE_SERVICO } from '../../../../../componentes/servico';
import { AguardandoEnvio, Status } from '../../../../../componentes/status';
import { cores, espaco, raio } from '../../../../../componentes/tema';
import { proximaParada } from '../../../../../rotas/proxima-parada';

const TEXTO_CONCLUIR: Record<Servico['tipo'], string> = { COLETA: 'Coleta realizada', ENTREGA: 'Entrega concluída' };

// Cores próximas às dos apps, escurecidas para manter contraste no fundo branco.
const COR_WAZE = '#0b9bd0';
const COR_MAPS = '#1a73e8';
const COR_WHATSAPP = '#1a9e4b';

type Ocorrencia = { modo: 'nao-realizar'; servico: Servico } | { modo: 'informativa' } | null;

export default function TelaParada() {
  const { id, paradaId } = useLocalSearchParams<{ id: string; paradaId: string }>();
  const router = useRouter();
  // Rota com os comandos ainda na fila aplicados: a próxima ação fica liberada mesmo sem sinal.
  const { consulta, rota, pendentes, aguardando } = useRotaProjetada(id);
  const enviarComando = useEnviarComando();
  const [ocorrencia, setOcorrencia] = useState<Ocorrencia>(null);
  const [ocorrenciaRegistrada, setOcorrenciaRegistrada] = useState<string | null>(null);
  const [entregaParaComprovar, setEntregaParaComprovar] = useState<Servico | null>(null);

  if (consulta.isPending) return <Carregando />;
  const parada = rota?.paradas.find((p) => p.id === paradaId);
  if (!rota || !parada) {
    return (
      <Tela>
        <Aviso tom="perigo" texto="Parada não encontrada. A rota pode ter sido alterada pela administração." />
        <Botao titulo="Voltar para a rota" icone="arrow-left" variante="secundaria" onPress={() => router.back()} />
      </Tela>
    );
  }

  const acoes = acoesMotoristaParada(rota.status, parada.status);
  const aguardandoParada = aguardando.has(parada.id) || parada.servicos.some((s) => aguardando.has(s.id));
  const ocorrenciaNaFila = pendentes.some((c) => c.alvoId === parada.id && c.caminho.endsWith('/ocorrencias'));
  const servicosPendentes = parada.servicos.filter((s) => s.status === 'PENDENTE');
  const encerrada = parada.status === 'FINALIZADA' || parada.status === 'CANCELADA';
  const seguinte = encerrada && rota.status === 'EM_ANDAMENTO' ? proximaParada(rota.paradas, parada.id) : undefined;
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
    // Entrega abre o comprovante (foto, assinatura, nome); coleta só confirma.
    if (servico.tipo === 'ENTREGA') {
      setEntregaParaComprovar(servico);
      return;
    }
    Alert.alert(`${TEXTO_CONCLUIR[servico.tipo]}?`, `${parada!.nomeEmpresa}. Esta confirmação não pode ser desfeita pelo app.`, [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: () => comando(`/motorista/servicos/${servico.id}/realizar`, servico.id, TEXTO_CONCLUIR[servico.tipo]),
      },
    ]);
  }

  function concluirEntrega(comprovante: ComprovanteEntrada | undefined) {
    const servico = entregaParaComprovar;
    setEntregaParaComprovar(null);
    if (!servico) return;
    comando(
      `/motorista/servicos/${servico.id}/realizar`,
      servico.id,
      TEXTO_CONCLUIR[servico.tipo],
      comprovante ? { comprovante } : undefined,
    );
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
      setOcorrenciaRegistrada(ROTULO_TIPO_OCORRENCIA[tipo]);
    }
    setOcorrencia(null);
  }

  const rodape = acoes.seguir ? (
    <Botao titulo="Ir para esta parada" icone="navigation-variant-outline" onPress={seguir} />
  ) : acoes.chegar ? (
    <Botao
      titulo="Cheguei ao local"
      icone="map-marker-check-outline"
      onPress={() => comando(`/motorista/paradas/${parada.id}/cheguei`, parada.id, 'Cheguei ao local')}
    />
  ) : acoes.realizarServico ? (
    <>
      {servicosPendentes.map((s) => (
        <Botao key={s.id} titulo={TEXTO_CONCLUIR[s.tipo]} icone="check-circle-outline" onPress={() => concluir(s)} />
      ))}
    </>
  ) : seguinte ? (
    <Botao
      titulo={`Próxima parada: ${seguinte.nomeEmpresa}`}
      icone="arrow-right"
      onPress={() => router.replace(`/rotas/${rota.id}/paradas/${seguinte.id}`)}
    />
  ) : encerrada ? (
    <Botao titulo="Voltar para a rota" icone="format-list-numbered" variante="secundaria" onPress={() => router.back()} />
  ) : null;

  const outrasAcoes = [
    ...(acoes.naoRealizarServico
      ? servicosPendentes.map((s) => (
          <LinhaAcao
            key={`nao-${s.id}`}
            icone="close-circle-outline"
            titulo={`Não foi possível: ${ROTULO_TIPO_SERVICO[s.tipo].toLowerCase()}`}
            perigo
            onPress={() => setOcorrencia({ modo: 'nao-realizar', servico: s })}
          />
        ))
      : []),
    ...(acoes.registrarOcorrencia
      ? [
          <LinhaAcao
            key="ocorrencia"
            icone="alert-circle-outline"
            titulo="Registrar ocorrência"
            onPress={() => setOcorrencia({ modo: 'informativa' })}
          />,
        ]
      : []),
    ...(acoes.voltarParaFila
      ? [
          <LinhaAcao
            key="fila"
            icone="undo-variant"
            titulo="Voltar esta parada para a fila"
            onPress={() => comando(`/motorista/paradas/${parada.id}/voltar-para-fila`, parada.id, 'Voltar para a fila')}
          />,
        ]
      : []),
  ];

  return (
    <>
      <Stack.Screen options={{ title: `Parada ${parada.sequencia} de ${rota.paradas.length}` }} />
      <StatusBar style="dark" />
      <Tela rodape={rodape}>
        <BannerConexao />
        {ocorrenciaRegistrada ? (
          <Aviso
            tom={ocorrenciaNaFila ? 'info' : 'sucesso'}
            texto={
              ocorrenciaNaFila
                ? `Ocorrência anotada: ${ocorrenciaRegistrada}. Será enviada quando houver sinal.`
                : `Ocorrência registrada: ${ocorrenciaRegistrada}.`
            }
          />
        ) : null}
        <Cartao destaque={!encerrada && rota.status === 'EM_ANDAMENTO'}>
          <View style={estilos.linhaStatus}>
            <Status tipo="parada" status={parada.status} />
            {aguardandoParada ? <AguardandoEnvio /> : null}
          </View>
          <Text accessibilityRole="header" style={estilos.nome}>
            {parada.nomeEmpresa}
          </Text>
          <View style={estilos.linhaEndereco}>
            <Icone nome="map-marker-outline" tamanho={20} cor={cores.textoSecundario} />
            <Text style={estilos.endereco}>{parada.enderecoFormatado}</Text>
          </View>
          {parada.observacoes ? (
            <Aviso icone="message-alert-outline" texto={`Observação da administração: ${parada.observacoes}`} />
          ) : null}
        </Cartao>

        <View style={estilos.atalhos}>
          <Atalho icone="waze" rotulo="Waze" cor={COR_WAZE} onPress={navegar} />
          <Atalho icone="google-maps" rotulo="Maps" cor={COR_MAPS} onPress={() => void abrirExterno(linkGoogleMaps(parada))} />
          {parada.whatsapp ? (
            <Atalho icone="whatsapp" rotulo="WhatsApp" cor={COR_WHATSAPP} onPress={() => void abrirExterno(linkWhatsApp(parada.whatsapp!))} />
          ) : null}
        </View>

        <TituloSecao texto="Serviços" />
        <GrupoAcoes>
          {parada.servicos.map((s) => (
            <View key={s.id} style={estilos.servico}>
              <View style={estilos.iconeServico}>
                <Icone nome={ICONE_SERVICO[s.tipo]} cor={cores.primaria} />
              </View>
              <View style={estilos.infoServico}>
                <Text style={estilos.tipo}>{ROTULO_TIPO_SERVICO[s.tipo]}</Text>
                {aguardando.has(s.id) ? (
                  <AguardandoEnvio />
                ) : s.concluidoEm ? (
                  <Text style={estilos.hora}>às {formatarHora(s.concluidoEm)}</Text>
                ) : null}
              </View>
              {/* O selo usa alignSelf: flex-start; o View o centraliza na linha. */}
              <View>
                <Status tipo="servico" status={s.status} />
              </View>
            </View>
          ))}
        </GrupoAcoes>

        {outrasAcoes.length > 0 ? (
          <>
            <TituloSecao texto="Outras ações" />
            <GrupoAcoes>{outrasAcoes}</GrupoAcoes>
          </>
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
      <ComprovanteEntrega
        visivel={entregaParaComprovar !== null}
        empresa={parada.nomeEmpresa}
        onCancelar={() => setEntregaParaComprovar(null)}
        onConfirmar={concluirEntrega}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  linhaStatus: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco.p },
  nome: { fontSize: 26, fontWeight: '800', color: cores.texto, letterSpacing: -0.5, marginTop: 4 },
  linhaEndereco: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  endereco: { flex: 1, fontSize: 16, color: cores.textoSecundario, lineHeight: 22 },
  atalhos: { flexDirection: 'row', gap: espaco.p + 2 },
  servico: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.g,
    paddingVertical: espaco.p,
  },
  iconeServico: {
    width: 40,
    height: 40,
    borderRadius: raio.m,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.primariaSuave,
  },
  infoServico: { flex: 1, gap: 2 },
  tipo: { fontSize: 17, fontWeight: '700', color: cores.texto },
  hora: { fontSize: 14, color: cores.textoSecundario },
});

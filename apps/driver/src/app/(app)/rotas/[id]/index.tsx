import { acoesMotoristaRota, type Parada } from '@rotas/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useEnviarComando, useFilaPendente, useRota } from '../../../../api/consultas';
import { BannerConexao } from '../../../../componentes/banner-conexao';
import { Aviso, BarraProgresso, Botao, Carregando, Cartao, Tela, TituloSecao } from '../../../../componentes/basicos';
import { formatarData } from '../../../../componentes/formatos';
import { Icone } from '../../../../componentes/icone';
import { ChipServico } from '../../../../componentes/servico';
import { Status } from '../../../../componentes/status';
import { cores, espaco, raio, sombra } from '../../../../componentes/tema';
import { proximaParada } from '../../../../rotas/proxima-parada';

/** Bolinha da linha do tempo: número da parada, ou ✓ / × quando encerrada. */
function Marcador({ parada, atual }: { parada: Parada; atual: boolean }) {
  if (parada.status === 'FINALIZADA') {
    return (
      <View style={[estilos.marcador, { backgroundColor: cores.sucesso, borderColor: cores.sucesso }]}>
        <Icone nome="check" tamanho={18} cor={cores.primariaTexto} />
      </View>
    );
  }
  if (parada.status === 'CANCELADA') {
    return (
      <View style={[estilos.marcador, { backgroundColor: cores.neutroFundo, borderColor: cores.bordaForte }]}>
        <Icone nome="close" tamanho={18} cor={cores.neutro} />
      </View>
    );
  }
  return (
    <View style={[estilos.marcador, atual && { backgroundColor: cores.primaria, borderColor: cores.primaria }]}>
      <Text style={[estilos.numeroMarcador, atual && { color: cores.primariaTexto }]}>{parada.sequencia}</Text>
    </View>
  );
}

export default function TelaRota() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const consulta = useRota(id);
  const enviarComando = useEnviarComando();
  const pendentes = useFilaPendente();

  if (consulta.isPending) return <Carregando texto="Abrindo a rota…" />;
  if (consulta.isError && !consulta.data) {
    return (
      <Tela>
        <Aviso tom="perigo" texto="Não foi possível abrir a rota. Ela pode ter sido transferida ou cancelada." />
        <Botao titulo="Voltar" icone="arrow-left" variante="secundaria" onPress={() => router.back()} />
      </Tela>
    );
  }

  const rota = consulta.data;
  const acoes = acoesMotoristaRota(rota.status);
  const aguardando = pendentes.some((c) => c.alvoId === rota.id);
  const proxima = proximaParada(rota.paradas);
  const feitas = rota.paradas.filter((p) => p.status === 'FINALIZADA' || p.status === 'CANCELADA').length;

  function confirmarRecebimento() {
    void enviarComando({
      caminho: `/motorista/rotas/${rota.id}/confirmar-recebimento`,
      rotaId: rota.id,
      alvoId: rota.id,
      descricao: 'Confirmar recebimento',
    });
  }

  function iniciar() {
    Alert.alert('Iniciar rota?', `${rota.paradas.length} paradas. Você poderá seguir a ordem sugerida ou escolher outra.`, [
      { text: 'Agora não', style: 'cancel' },
      {
        text: 'Iniciar',
        onPress: () =>
          void enviarComando({ caminho: `/motorista/rotas/${rota.id}/iniciar`, rotaId: rota.id, alvoId: rota.id, descricao: 'Iniciar rota' }),
      },
    ]);
  }

  const acaoPrincipal = aguardando ? (
    <Botao titulo="Aguardando envio…" icone="cloud-upload-outline" onPress={() => undefined} desabilitado />
  ) : acoes.confirmarRecebimento ? (
    <Botao titulo="Confirmar recebimento" icone="clipboard-check-outline" onPress={confirmarRecebimento} />
  ) : acoes.iniciar ? (
    <Botao titulo="Iniciar rota" icone="play-circle-outline" onPress={iniciar} />
  ) : rota.status === 'EM_ANDAMENTO' && proxima ? (
    <Botao
      titulo={`Próxima parada: ${proxima.nomeEmpresa}`}
      icone="arrow-right"
      onPress={() => router.push(`/rotas/${rota.id}/paradas/${proxima.id}`)}
    />
  ) : null;

  return (
    <>
      <Stack.Screen options={{ title: rota.nome }} />
      <StatusBar style="dark" />
      <Tela refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => void consulta.refetch()} />} rodape={acaoPrincipal}>
        <BannerConexao />
        <Cartao>
          <View style={estilos.linhaResumo}>
            <Status tipo="rota" status={rota.status} />
            <View style={estilos.linhaMeta}>
              <Icone nome="calendar-blank-outline" tamanho={16} cor={cores.textoSecundario} />
              <Text style={estilos.meta}>{formatarData(rota.dataPrevista)}</Text>
            </View>
          </View>
          <View style={estilos.progresso}>
            <Text style={estilos.numeroProgresso}>{feitas}</Text>
            <Text style={estilos.textoProgresso}>de {rota.paradas.length} paradas concluídas</Text>
          </View>
          <BarraProgresso feitas={feitas} total={rota.paradas.length} />
        </Cartao>
        {rota.status === 'CONCLUIDA' ? <Aviso tom="sucesso" icone="flag-checkered" texto="Rota concluída. Obrigado!" /> : null}
        {rota.status === 'CANCELADA' ? (
          <Aviso tom="perigo" texto={`Rota cancelada pela administração. ${rota.motivoCancelamento ?? ''}`} />
        ) : null}

        <TituloSecao texto="Paradas" direita={`${rota.paradas.length} no total`} />
        <View>
          {rota.paradas.map((parada, i) => {
            const atual = rota.status === 'EM_ANDAMENTO' && parada.id === proxima?.id;
            const encerrada = parada.status === 'FINALIZADA' || parada.status === 'CANCELADA';
            const ultima = i === rota.paradas.length - 1;
            const aguardandoParada = pendentes.some(
              (c) => c.alvoId === parada.id || parada.servicos.some((s) => s.id === c.alvoId),
            );
            return (
              <View key={parada.id} style={[estilos.item, !ultima && { paddingBottom: espaco.m }]}>
                <View style={estilos.trilha}>
                  <Marcador parada={parada} atual={atual} />
                  {!ultima ? <View style={[estilos.linhaVertical, encerrada && { backgroundColor: cores.sucesso }]} /> : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/rotas/${rota.id}/paradas/${parada.id}`)}
                  style={({ pressed }) => [
                    estilos.parada,
                    sombra.cartao,
                    atual && estilos.paradaAtual,
                    encerrada && estilos.paradaEncerrada,
                    pressed && { opacity: 0.92 },
                  ]}
                >
                  {atual ? <Text style={estilos.etiquetaAtual}>PRÓXIMA</Text> : null}
                  <Text style={estilos.nome}>{parada.nomeEmpresa}</Text>
                  <View style={estilos.linhaEndereco}>
                    <Icone nome="map-marker-outline" tamanho={18} cor={cores.textoSecundario} />
                    <Text style={estilos.endereco}>{parada.enderecoFormatado}</Text>
                  </View>
                  <View style={estilos.chips}>
                    {parada.servicos.map((s) => (
                      <ChipServico key={s.id} tipo={s.tipo} />
                    ))}
                  </View>
                  {parada.observacoes ? (
                    <View style={estilos.obs}>
                      <Icone nome="message-alert-outline" tamanho={18} cor={cores.alerta} />
                      <Text style={estilos.textoObs}>{parada.observacoes}</Text>
                    </View>
                  ) : null}
                  <View style={estilos.rodapeParada}>
                    <Status tipo="parada" status={parada.status} />
                    {aguardandoParada ? (
                      <View style={estilos.linhaMeta}>
                        <Icone nome="cloud-upload-outline" tamanho={16} cor={cores.info} />
                        <Text style={estilos.aguardando}>Aguardando envio…</Text>
                      </View>
                    ) : (
                      <Icone nome="chevron-right" cor={cores.textoSecundario} />
                    )}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </Tela>
    </>
  );
}

const estilos = StyleSheet.create({
  linhaResumo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linhaMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 15, fontWeight: '500', color: cores.textoSecundario },
  progresso: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  numeroProgresso: { fontSize: 34, fontWeight: '800', color: cores.texto, letterSpacing: -1 },
  textoProgresso: { fontSize: 16, fontWeight: '600', color: cores.textoSecundario },
  item: { flexDirection: 'row', gap: espaco.m },
  trilha: { width: 34, alignItems: 'center' },
  marcador: {
    width: 34,
    height: 34,
    borderRadius: raio.pilula,
    borderWidth: 2,
    borderColor: cores.bordaForte,
    backgroundColor: cores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: espaco.g,
  },
  numeroMarcador: { fontSize: 15, fontWeight: '800', color: cores.textoSecundario },
  linhaVertical: { flex: 1, width: 2, borderRadius: 1, backgroundColor: cores.borda, marginTop: 4, marginBottom: -espaco.g },
  parada: {
    flex: 1,
    backgroundColor: cores.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.g,
    gap: espaco.p,
  },
  paradaAtual: { borderColor: cores.primaria, borderWidth: 1.5 },
  paradaEncerrada: { backgroundColor: cores.superficieSuave },
  etiquetaAtual: { fontSize: 13, fontWeight: '800', color: cores.primaria, letterSpacing: 1 },
  nome: { fontSize: 18, fontWeight: '800', color: cores.texto, letterSpacing: -0.2 },
  linhaEndereco: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  endereco: { flex: 1, fontSize: 15, color: cores.textoSecundario, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  obs: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: cores.alertaFundo,
    borderRadius: raio.p + 2,
    padding: espaco.p + 2,
  },
  textoObs: { flex: 1, fontSize: 15, fontWeight: '600', color: cores.alerta },
  rodapeParada: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  aguardando: { fontSize: 14, fontWeight: '700', color: cores.info },
});

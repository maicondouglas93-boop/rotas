import { acoesMotoristaRota, ROTULO_TIPO_SERVICO, type Parada } from '@rotas/shared';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useEnviarComando, useFilaPendente, useRota } from '../../../../api/consultas';
import { BannerConexao } from '../../../../componentes/banner-conexao';
import { Aviso, Botao, Carregando, Tela } from '../../../../componentes/basicos';
import { Status } from '../../../../componentes/status';
import { ALVO_TOQUE, cores } from '../../../../componentes/tema';

function proximaParada(paradas: Parada[]): Parada | undefined {
  return (
    paradas.find((p) => p.status === 'NO_LOCAL' || p.status === 'A_CAMINHO') ??
    paradas.find((p) => p.status === 'PENDENTE')
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
        <Botao titulo="Voltar" variante="secundaria" onPress={() => router.back()} />
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
    <Botao titulo="Aguardando envio…" onPress={() => undefined} desabilitado />
  ) : acoes.confirmarRecebimento ? (
    <Botao titulo="Confirmar recebimento" onPress={confirmarRecebimento} />
  ) : acoes.iniciar ? (
    <Botao titulo="Iniciar rota" onPress={iniciar} />
  ) : rota.status === 'EM_ANDAMENTO' && proxima ? (
    <Botao titulo={`Próxima parada: ${proxima.nomeEmpresa}`} onPress={() => router.push(`/rotas/${rota.id}/paradas/${proxima.id}`)} />
  ) : null;

  return (
    <>
      <Stack.Screen options={{ title: rota.nome }} />
      <Tela refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => void consulta.refetch()} />} rodape={acaoPrincipal}>
        <BannerConexao />
        <View style={estilos.cabecalho}>
          <Status tipo="rota" status={rota.status} />
          <Text style={estilos.progresso}>
            {feitas} de {rota.paradas.length} paradas concluídas
          </Text>
        </View>
        {rota.status === 'CONCLUIDA' ? <Aviso tom="info" texto="Rota concluída. Obrigado!" /> : null}
        {rota.status === 'CANCELADA' ? <Aviso tom="perigo" texto={`Rota cancelada pela administração. ${rota.motivoCancelamento ?? ''}`} /> : null}

        {rota.paradas.map((parada) => (
          <Link key={parada.id} href={`/rotas/${rota.id}/paradas/${parada.id}`} asChild>
            <Pressable accessibilityRole="button" style={({ pressed }) => [estilos.parada, pressed && { opacity: 0.85 }]}>
              <View style={estilos.linha}>
                <Text style={estilos.sequencia}>{parada.sequencia}</Text>
                <View style={estilos.info}>
                  <Text style={estilos.nome}>{parada.nomeEmpresa}</Text>
                  <Text style={estilos.endereco}>{parada.enderecoFormatado}</Text>
                  <Text style={estilos.servicos}>{parada.servicos.map((s) => ROTULO_TIPO_SERVICO[s.tipo]).join(' e ')}</Text>
                  {parada.observacoes ? <Text style={estilos.obs}>Obs.: {parada.observacoes}</Text> : null}
                </View>
              </View>
              <Status tipo="parada" status={parada.status} />
              {pendentes.some((c) => c.alvoId === parada.id || parada.servicos.some((s) => s.id === c.alvoId)) ? (
                <Text style={estilos.aguardando}>Aguardando envio…</Text>
              ) : null}
            </Pressable>
          </Link>
        ))}
      </Tela>
    </>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progresso: { fontSize: 16, color: cores.textoSecundario },
  parada: {
    minHeight: ALVO_TOQUE * 2,
    backgroundColor: cores.superficie,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 16,
    gap: 8,
  },
  linha: { flexDirection: 'row', gap: 12 },
  sequencia: { fontSize: 20, fontWeight: '800', color: cores.texto, minWidth: 24 },
  info: { flex: 1, gap: 2 },
  nome: { fontSize: 18, fontWeight: '700', color: cores.texto },
  endereco: { fontSize: 15, color: cores.textoSecundario },
  servicos: { fontSize: 15, fontWeight: '600', color: cores.texto, marginTop: 4 },
  obs: { fontSize: 15, color: cores.alerta, marginTop: 4 },
  aguardando: { fontSize: 14, fontWeight: '600', color: cores.info },
});

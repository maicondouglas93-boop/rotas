import type { RotaResumo, StatusRota } from '@rotas/shared';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFilaPendente, useMinhasRotas } from '../../api/consultas';
import { BannerConexao } from '../../componentes/banner-conexao';
import { Aviso, BarraProgresso, Botao, BotaoIcone, Carregando, Tela, TituloSecao } from '../../componentes/basicos';
import { dataPorExtenso, formatarData, primeiroNome } from '../../componentes/formatos';
import { Icone, type NomeIcone } from '../../componentes/icone';
import { Status } from '../../componentes/status';
import { cores, espaco, GRADIENTE_MARCA, raio, sombra } from '../../componentes/tema';
import { useSessao } from '../../sessao/sessao';

const GRUPOS: { titulo: string; status: StatusRota[] }[] = [
  { titulo: 'Em andamento', status: ['EM_ANDAMENTO'] },
  { titulo: 'Novas — confirme o recebimento', status: ['ENVIADA'] },
  { titulo: 'Recebidas — prontas para iniciar', status: ['RECEBIDA'] },
];

function CartaoRota({ rota }: { rota: RotaResumo }) {
  const router = useRouter();
  const emAndamento = rota.status === 'EM_ANDAMENTO';
  // Pressable direto (sem Link asChild): o Slot do Link descarta o estilo em forma de função.
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/rotas/${rota.id}`)}
      style={({ pressed }) => [
        estilos.cartaoRota,
        sombra.cartao,
        emAndamento && estilos.cartaoAtivo,
        pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={estilos.topoRota}>
        <View style={[estilos.iconeRota, emAndamento && { backgroundColor: cores.primaria }]}>
          <Icone nome="map-marker-path" cor={emAndamento ? cores.primariaTexto : cores.primaria} />
        </View>
        <View style={estilos.infoRota}>
          <Text style={estilos.nomeRota} numberOfLines={2}>
            {rota.nome}
          </Text>
          <View style={estilos.linhaMeta}>
            <Icone nome="calendar-blank-outline" tamanho={16} cor={cores.textoSecundario} />
            <Text style={estilos.meta}>{formatarData(rota.dataPrevista)}</Text>
          </View>
        </View>
        <Icone nome="chevron-right" cor={cores.textoSecundario} />
      </View>
      <View style={estilos.rodapeRota}>
        <Status tipo="rota" status={rota.status} />
        <Text style={estilos.meta}>
          {rota.paradasConcluidas} de {rota.totalParadas} paradas
        </Text>
      </View>
      <BarraProgresso feitas={rota.paradasConcluidas} total={rota.totalParadas} />
    </Pressable>
  );
}

function Resumo({ numero, rotulo, icone, cor }: { numero: number; rotulo: string; icone: NomeIcone; cor: string }) {
  return (
    <View style={[estilos.resumoItem, sombra.elevada]}>
      <View style={[estilos.resumoIcone, { backgroundColor: `${cor}1a` }]}>
        <Icone nome={icone} tamanho={20} cor={cor} />
      </View>
      <Text style={estilos.resumoNumero}>{numero}</Text>
      <Text style={estilos.resumoRotulo} numberOfLines={1}>
        {rotulo}
      </Text>
    </View>
  );
}

export default function Inicio() {
  const { estado, sair } = useSessao();
  const insets = useSafeAreaInsets();
  const abertas = useMinhasRotas('abertas');
  const concluidas = useMinhasRotas('concluidas');
  const pendentes = useFilaPendente().length;
  const nome = estado.situacao === 'autenticado' ? (estado.usuario.nome ?? estado.usuario.email) : '';
  const rotas = abertas.data?.itens ?? [];
  const aFazer = rotas.filter((r) => r.status === 'ENVIADA' || r.status === 'RECEBIDA').length;
  const emAndamento = rotas.filter((r) => r.status === 'EM_ANDAMENTO').length;

  // Sair apaga a fila do aparelho: avisa quando ainda há ações sem enviar.
  function confirmarSaida() {
    Alert.alert(
      'Sair do aplicativo?',
      pendentes > 0
        ? `Há ${pendentes === 1 ? '1 ação' : `${pendentes} ações`} aguardando envio. Se sair agora, ${pendentes === 1 ? 'ela será descartada' : 'elas serão descartadas'}.`
        : 'Você precisará entrar de novo com e-mail e senha.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => void sair() },
      ],
    );
  }

  const resumoDoDia =
    emAndamento > 0
      ? `${emAndamento === 1 ? '1 rota' : `${emAndamento} rotas`} em andamento`
      : aFazer > 0
        ? `${aFazer === 1 ? '1 rota' : `${aFazer} rotas`} esperando por você`
        : 'Nenhuma rota pendente';

  const topo = (
    <LinearGradient
      colors={GRADIENTE_MARCA}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[estilos.hero, { paddingTop: insets.top + espaco.g }]}
    >
      <View style={estilos.linhaHero}>
        <Text style={estilos.data}>{dataPorExtenso(new Date())}</Text>
        <BotaoIcone icone="logout" rotulo="Sair" claro onPress={confirmarSaida} />
      </View>
      <Text accessibilityRole="header" style={estilos.ola}>
        Olá, {primeiroNome(nome)}
      </Text>
      <Text style={estilos.resumoDia}>{resumoDoDia}</Text>
    </LinearGradient>
  );

  return (
    <>
      <StatusBar style="light" />
      <Tela
        topo={topo}
        refreshControl={
          <RefreshControl
            refreshing={abertas.isRefetching}
            progressViewOffset={insets.top}
            onRefresh={() => {
              void abertas.refetch();
              void concluidas.refetch();
            }}
          />
        }
      >
        <View style={estilos.resumo}>
          <Resumo numero={aFazer} rotulo="A fazer" icone="clipboard-text-outline" cor={cores.info} />
          <Resumo numero={emAndamento} rotulo="Em andamento" icone="truck-fast-outline" cor={cores.alerta} />
          <Resumo numero={concluidas.data?.total ?? 0} rotulo="Concluídas" icone="check-decagram-outline" cor={cores.sucesso} />
        </View>
        <BannerConexao />

        {abertas.isPending ? (
          <Carregando texto="Buscando suas rotas…" />
        ) : abertas.isError && rotas.length === 0 ? (
          <>
            <Aviso tom="perigo" texto="Não foi possível carregar as rotas." />
            <Botao titulo="Tentar novamente" icone="refresh" variante="suave" onPress={() => void abertas.refetch()} />
          </>
        ) : rotas.length === 0 ? (
          <View style={[estilos.vazio, sombra.cartao]}>
            <View style={estilos.vazioIcone}>
              <Icone nome="coffee-outline" tamanho={34} cor={cores.primaria} />
            </View>
            <Text style={estilos.vazioTitulo}>Tudo em dia</Text>
            <Text style={estilos.vazioTexto}>Nenhuma rota para você agora. Puxe a tela para baixo para atualizar.</Text>
          </View>
        ) : (
          GRUPOS.map((grupo) => {
            const doGrupo = rotas.filter((r) => grupo.status.includes(r.status));
            if (doGrupo.length === 0) return null;
            return (
              <View key={grupo.titulo} style={estilos.grupo}>
                <TituloSecao texto={grupo.titulo} />
                {doGrupo.map((rota) => (
                  <CartaoRota key={rota.id} rota={rota} />
                ))}
              </View>
            );
          })
        )}
      </Tela>
    </>
  );
}

const estilos = StyleSheet.create({
  hero: {
    paddingHorizontal: espaco.g + 4,
    paddingBottom: 64,
    gap: 4,
    borderBottomLeftRadius: raio.gg + 6,
    borderBottomRightRadius: raio.gg + 6,
  },
  linhaHero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: espaco.p },
  data: { fontSize: 15, fontWeight: '600', color: 'rgba(255, 255, 255, 0.8)' },
  ola: { fontSize: 30, fontWeight: '800', color: cores.primariaTexto, letterSpacing: -0.6 },
  resumoDia: { fontSize: 16, color: 'rgba(255, 255, 255, 0.85)' },
  resumo: { flexDirection: 'row', gap: espaco.p + 2, marginTop: -48 },
  resumoItem: {
    flex: 1,
    backgroundColor: cores.superficie,
    borderRadius: raio.g,
    paddingVertical: espaco.m + 2,
    paddingHorizontal: espaco.p,
    alignItems: 'center',
    gap: 4,
  },
  resumoIcone: { width: 36, height: 36, borderRadius: raio.m, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  resumoNumero: { fontSize: 26, fontWeight: '800', color: cores.texto, letterSpacing: -0.5 },
  resumoRotulo: { fontSize: 14, fontWeight: '600', color: cores.textoSecundario },
  grupo: { gap: espaco.m },
  cartaoRota: {
    backgroundColor: cores.superficie,
    borderRadius: raio.g + 2,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.g,
    gap: espaco.m,
  },
  cartaoAtivo: { borderColor: cores.primaria, borderWidth: 1.5 },
  topoRota: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  iconeRota: {
    width: 46,
    height: 46,
    borderRadius: raio.m + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.primariaSuave,
  },
  infoRota: { flex: 1, gap: 3 },
  nomeRota: { fontSize: 18, fontWeight: '800', color: cores.texto, letterSpacing: -0.2 },
  linhaMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 15, fontWeight: '500', color: cores.textoSecundario },
  rodapeRota: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vazio: {
    alignItems: 'center',
    gap: espaco.p,
    backgroundColor: cores.superficie,
    borderRadius: raio.g + 2,
    padding: espaco.gg,
    marginTop: espaco.p,
  },
  vazioIcone: {
    width: 68,
    height: 68,
    borderRadius: raio.pilula,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.primariaSuave,
    marginBottom: 4,
  },
  vazioTitulo: { fontSize: 20, fontWeight: '800', color: cores.texto },
  vazioTexto: { fontSize: 16, color: cores.textoSecundario, textAlign: 'center', lineHeight: 22 },
});

import type { RotaResumo, StatusRota } from '@rotas/shared';
import { Link, Stack } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useMinhasRotas } from '../../api/consultas';
import { BannerConexao } from '../../componentes/banner-conexao';
import { Aviso, Botao, Carregando, Tela } from '../../componentes/basicos';
import { Status } from '../../componentes/status';
import { ALVO_TOQUE, cores } from '../../componentes/tema';
import { useSessao } from '../../sessao/sessao';

const GRUPOS: { titulo: string; status: StatusRota[] }[] = [
  { titulo: 'Em andamento', status: ['EM_ANDAMENTO'] },
  { titulo: 'Novas — confirme o recebimento', status: ['ENVIADA'] },
  { titulo: 'Recebidas — prontas para iniciar', status: ['RECEBIDA'] },
];

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function CartaoRota({ rota }: { rota: RotaResumo }) {
  return (
    <Link href={`/rotas/${rota.id}`} asChild>
      <Pressable accessibilityRole="button" style={({ pressed }) => [estilos.cartao, pressed && { opacity: 0.85 }]}>
        <View style={estilos.linha}>
          <Text style={estilos.nome} numberOfLines={2}>
            {rota.nome}
          </Text>
          <Status tipo="rota" status={rota.status} />
        </View>
        <Text style={estilos.detalhe}>
          {formatarData(rota.dataPrevista)} · {rota.paradasConcluidas} de {rota.totalParadas} paradas concluídas
        </Text>
      </Pressable>
    </Link>
  );
}

export default function Inicio() {
  const { estado, sair } = useSessao();
  const abertas = useMinhasRotas('abertas');
  const concluidas = useMinhasRotas('concluidas');
  const nome = estado.situacao === 'autenticado' ? (estado.usuario.nome ?? estado.usuario.email) : '';
  const rotas = abertas.data?.itens ?? [];

  return (
    <>
      <Stack.Screen options={{ title: 'Minhas rotas' }} />
      <Tela
        refreshControl={
          <RefreshControl
            refreshing={abertas.isRefetching}
            onRefresh={() => {
              void abertas.refetch();
              void concluidas.refetch();
            }}
          />
        }
        rodape={<Botao titulo="Sair" variante="secundaria" onPress={() => void sair()} />}
      >
        <Text style={estilos.ola}>Olá, {nome}</Text>
        <BannerConexao />
        <View style={estilos.resumo}>
          <Resumo numero={rotas.filter((r) => r.status === 'ENVIADA' || r.status === 'RECEBIDA').length} rotulo="A fazer" />
          <Resumo numero={rotas.filter((r) => r.status === 'EM_ANDAMENTO').length} rotulo="Em andamento" />
          <Resumo numero={concluidas.data?.total ?? 0} rotulo="Concluídas" />
        </View>

        {abertas.isPending ? (
          <Carregando texto="Buscando suas rotas…" />
        ) : abertas.isError && rotas.length === 0 ? (
          <>
            <Aviso tom="perigo" texto="Não foi possível carregar as rotas." />
            <Botao titulo="Tentar novamente" variante="secundaria" onPress={() => void abertas.refetch()} />
          </>
        ) : rotas.length === 0 ? (
          <Text style={estilos.vazio}>Nenhuma rota para você agora. Puxe a tela para baixo para atualizar.</Text>
        ) : (
          GRUPOS.map((grupo) => {
            const doGrupo = rotas.filter((r) => grupo.status.includes(r.status));
            if (doGrupo.length === 0) return null;
            return (
              <View key={grupo.titulo} style={estilos.grupo}>
                <Text style={estilos.tituloGrupo}>{grupo.titulo}</Text>
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

function Resumo({ numero, rotulo }: { numero: number; rotulo: string }) {
  return (
    <View style={estilos.resumoItem}>
      <Text style={estilos.resumoNumero}>{numero}</Text>
      <Text style={estilos.resumoRotulo}>{rotulo}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  ola: { fontSize: 22, fontWeight: '800', color: cores.texto },
  resumo: { flexDirection: 'row', gap: 8 },
  resumoItem: {
    flex: 1,
    backgroundColor: cores.superficie,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 12,
    alignItems: 'center',
  },
  resumoNumero: { fontSize: 24, fontWeight: '800', color: cores.texto },
  resumoRotulo: { fontSize: 14, color: cores.textoSecundario, textAlign: 'center' },
  grupo: { gap: 8 },
  tituloGrupo: { fontSize: 17, fontWeight: '700', color: cores.texto, marginTop: 8 },
  cartao: {
    minHeight: ALVO_TOQUE * 2,
    backgroundColor: cores.superficie,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 16,
    gap: 6,
  },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  nome: { flex: 1, fontSize: 18, fontWeight: '700', color: cores.texto },
  detalhe: { fontSize: 15, color: cores.textoSecundario },
  vazio: { fontSize: 16, color: cores.textoSecundario, textAlign: 'center', paddingVertical: 24 },
});

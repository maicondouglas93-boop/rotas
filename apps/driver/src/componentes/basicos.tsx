import * as Haptics from 'expo-haptics';
import { Children, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icone, type NomeIcone } from './icone';
import { ALVO_TOQUE, cores, espaco, raio, sombra } from './tema';

/** Toque curto de confirmação nas ações principais. Falha silenciosa (aparelho sem motor de vibração). */
export function vibrar(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

type Variante = 'primaria' | 'secundaria' | 'perigo' | 'suave';

const COR_TEXTO_BOTAO: Record<Variante, string> = {
  primaria: cores.primariaTexto,
  perigo: cores.primariaTexto,
  secundaria: cores.primaria,
  suave: cores.primaria,
};

export function Botao({
  titulo,
  onPress,
  variante = 'primaria',
  desabilitado = false,
  carregando = false,
  icone,
}: {
  titulo: string;
  onPress: () => void;
  variante?: Variante;
  desabilitado?: boolean;
  carregando?: boolean;
  icone?: NomeIcone;
}) {
  const inativo = desabilitado || carregando;
  const corTexto = COR_TEXTO_BOTAO[variante];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: inativo, busy: carregando }}
      onPress={() => {
        if (variante === 'primaria' || variante === 'perigo') vibrar();
        onPress();
      }}
      disabled={inativo}
      style={({ pressed }) => [
        estilos.botao,
        estilos[variante],
        variante === 'primaria' && !inativo ? sombra.botao : null,
        inativo && estilos.inativo,
        pressed && estilos.pressionado,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <>
          {icone ? <Icone nome={icone} cor={corTexto} /> : null}
          <Text style={[estilos.textoBotao, { color: corTexto }]} numberOfLines={2}>
            {titulo}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Botão redondo só com ícone (ex.: sair, fechar). O rótulo vai para o leitor de tela. */
export function BotaoIcone({
  icone,
  rotulo,
  onPress,
  claro = false,
}: {
  icone: NomeIcone;
  rotulo: string;
  onPress: () => void;
  claro?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [estilos.botaoIcone, claro ? estilos.botaoIconeClaro : null, pressed && estilos.pressionado]}
    >
      <Icone nome={icone} cor={claro ? cores.primariaTexto : cores.texto} />
    </Pressable>
  );
}

export function Campo({
  rotulo,
  erro,
  icone,
  direita,
  onFocus,
  onBlur,
  multiline,
  ...props
}: TextInputProps & { rotulo: string; erro?: string; icone?: NomeIcone; direita?: ReactNode }) {
  const [focado, setFocado] = useState(false);
  return (
    <View style={estilos.campo}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <View
        style={[
          estilos.caixaEntrada,
          multiline ? estilos.caixaMultilinha : null,
          focado && estilos.caixaFocada,
          erro ? estilos.caixaErro : null,
        ]}
      >
        {icone ? <Icone nome={icone} cor={focado ? cores.primaria : cores.textoSecundario} /> : null}
        <TextInput
          accessibilityLabel={rotulo}
          placeholderTextColor={cores.textoSecundario}
          style={[estilos.entrada, multiline ? estilos.entradaMultilinha : null]}
          multiline={multiline}
          onFocus={(e) => {
            setFocado(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocado(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {direita}
      </View>
      {erro ? (
        <Text accessibilityRole="alert" style={estilos.erro}>
          {erro}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Tela com rolagem, margens e área segura; aceita "puxar para atualizar".
 * `topo` ocupa a largura toda (sem margem), `rodape` fica fixo embaixo com a ação principal.
 */
export function Tela({
  children,
  refreshControl,
  rodape,
  topo,
}: {
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  rodape?: ReactNode;
  topo?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={estilos.tela} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: rodape ? espaco.gg : espaco.gg + insets.bottom }}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
      >
        {topo}
        <View style={estilos.conteudo}>{children}</View>
      </ScrollView>
      {rodape ? <View style={[estilos.rodape, { paddingBottom: espaco.g + insets.bottom }]}>{rodape}</View> : null}
    </SafeAreaView>
  );
}

export function Cartao({ children, destaque = false }: { children: ReactNode; destaque?: boolean }) {
  return <View style={[estilos.cartao, sombra.cartao, destaque && estilos.cartaoDestaque]}>{children}</View>;
}

type TomAviso = 'alerta' | 'info' | 'perigo' | 'sucesso';

const TOM_AVISO: Record<TomAviso, { fundo: string; cor: string; icone: NomeIcone }> = {
  alerta: { fundo: cores.alertaFundo, cor: cores.alerta, icone: 'alert-outline' },
  info: { fundo: cores.infoFundo, cor: cores.info, icone: 'information-outline' },
  perigo: { fundo: cores.perigoFundo, cor: cores.perigo, icone: 'alert-circle-outline' },
  sucesso: { fundo: cores.sucessoFundo, cor: cores.sucesso, icone: 'check-circle-outline' },
};

export function Aviso({ texto, tom = 'alerta', icone }: { texto: string; tom?: TomAviso; icone?: NomeIcone }) {
  const visual = TOM_AVISO[tom];
  return (
    <View accessibilityRole="alert" style={[estilos.aviso, { backgroundColor: visual.fundo }]}>
      <Icone nome={icone ?? visual.icone} cor={visual.cor} />
      <Text style={[estilos.textoAviso, { color: visual.cor }]}>{texto}</Text>
    </View>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <View style={estilos.carregando}>
      <ActivityIndicator size="large" color={cores.primaria} />
      <Text style={estilos.textoCarregando}>{texto}</Text>
    </View>
  );
}

export function TituloSecao({ texto, direita }: { texto: string; direita?: string }) {
  return (
    <View style={estilos.tituloSecao}>
      <Text accessibilityRole="header" style={estilos.textoTituloSecao}>
        {texto}
      </Text>
      {direita ? <Text style={estilos.direitaSecao}>{direita}</Text> : null}
    </View>
  );
}

export function BarraProgresso({ feitas, total, clara = false }: { feitas: number; total: number; clara?: boolean }) {
  const fracao = total > 0 ? Math.min(feitas / total, 1) : 0;
  const completa = total > 0 && feitas >= total;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: feitas }}
      style={[estilos.trilho, clara && estilos.trilhoClaro]}
    >
      <View
        style={[
          estilos.preenchimento,
          { width: `${fracao * 100}%`, backgroundColor: clara ? cores.destaque : completa ? cores.sucesso : cores.primaria },
        ]}
      />
    </View>
  );
}

/** Bloco quadrado de atalho (Waze, Maps, WhatsApp): ícone grande com a cor do app e rótulo curto. */
export function Atalho({ icone, rotulo, cor, onPress }: { icone: NomeIcone; rotulo: string; cor: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={onPress}
      style={({ pressed }) => [estilos.atalho, sombra.cartao, pressed && estilos.pressionado]}
    >
      <View style={[estilos.atalhoIcone, { backgroundColor: `${cor}1f` }]}>
        <Icone nome={icone} tamanho={28} cor={cor} />
      </View>
      <Text style={estilos.atalhoTexto} numberOfLines={1}>
        {rotulo}
      </Text>
    </Pressable>
  );
}

/** Lista de ações secundárias num cartão, separadas por linhas finas. */
export function GrupoAcoes({ children }: { children: ReactNode }) {
  const itens = Children.toArray(children);
  if (itens.length === 0) return null;
  return (
    <View style={[estilos.grupoAcoes, sombra.cartao]}>
      {itens.map((item, i) => (
        <View key={i} style={i > 0 ? estilos.separador : null}>
          {item}
        </View>
      ))}
    </View>
  );
}

export function LinhaAcao({
  icone,
  titulo,
  onPress,
  perigo = false,
}: {
  icone: NomeIcone;
  titulo: string;
  onPress: () => void;
  perigo?: boolean;
}) {
  const cor = perigo ? cores.perigo : cores.primaria;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      onPress={onPress}
      style={({ pressed }) => [estilos.linhaAcao, pressed && { backgroundColor: cores.superficieSuave }]}
    >
      <View style={[estilos.iconeLinha, { backgroundColor: perigo ? cores.perigoFundo : cores.primariaSuave }]}>
        <Icone nome={icone} cor={cor} />
      </View>
      <Text style={[estilos.textoLinha, perigo && { color: cores.perigo }]}>{titulo}</Text>
      <Icone nome="chevron-right" cor={cores.textoSecundario} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: ALVO_TOQUE + 8,
    borderRadius: raio.m + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: espaco.g,
  },
  primaria: { backgroundColor: cores.primaria },
  secundaria: { backgroundColor: cores.superficie, borderWidth: 1.5, borderColor: cores.primaria },
  perigo: { backgroundColor: cores.perigo },
  suave: { backgroundColor: cores.primariaSuave },
  inativo: { opacity: 0.45 },
  pressionado: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  textoBotao: { flexShrink: 1, fontSize: 17, fontWeight: '700', textAlign: 'center', letterSpacing: 0.2 },
  botaoIcone: {
    width: ALVO_TOQUE,
    height: ALVO_TOQUE,
    borderRadius: raio.pilula,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.neutroFundo,
  },
  botaoIconeClaro: { backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  campo: { gap: 6 },
  rotulo: { fontSize: 15, fontWeight: '600', color: cores.texto },
  caixaEntrada: {
    minHeight: ALVO_TOQUE + 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: cores.borda,
    borderRadius: raio.m,
    paddingHorizontal: espaco.m + 2,
    backgroundColor: cores.superficieSuave,
  },
  caixaMultilinha: { alignItems: 'flex-start', paddingVertical: espaco.m },
  caixaFocada: { borderColor: cores.primaria, backgroundColor: cores.superficie },
  caixaErro: { borderColor: cores.perigo },
  entrada: { flex: 1, minHeight: ALVO_TOQUE, fontSize: 17, color: cores.texto },
  entradaMultilinha: { minHeight: 96, textAlignVertical: 'top', paddingTop: 0 },
  erro: { color: cores.perigo, fontSize: 15 },
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.g, gap: espaco.m },
  rodape: {
    paddingHorizontal: espaco.g,
    paddingTop: espaco.m,
    gap: espaco.p,
    backgroundColor: cores.superficie,
    boxShadow: '0px -6px 18px rgba(16, 24, 40, 0.07)',
  },
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.g,
    gap: espaco.p,
  },
  cartaoDestaque: { borderColor: cores.primaria, borderWidth: 1.5 },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: raio.m, padding: espaco.m + 2 },
  textoAviso: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  carregando: { alignItems: 'center', gap: espaco.m, padding: espaco.ggg },
  textoCarregando: { fontSize: 16, color: cores.textoSecundario },
  tituloSecao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: espaco.p },
  textoTituloSecao: { fontSize: 14, fontWeight: '800', color: cores.textoSecundario, letterSpacing: 0.8, textTransform: 'uppercase' },
  direitaSecao: { fontSize: 14, fontWeight: '600', color: cores.textoSecundario },
  trilho: { height: 8, borderRadius: raio.pilula, backgroundColor: cores.neutroFundo, overflow: 'hidden' },
  trilhoClaro: { backgroundColor: 'rgba(255, 255, 255, 0.22)' },
  preenchimento: { height: '100%', borderRadius: raio.pilula },
  atalho: {
    flex: 1,
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.p,
    backgroundColor: cores.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingVertical: espaco.m,
  },
  atalhoIcone: { width: 48, height: 48, borderRadius: raio.m + 2, alignItems: 'center', justifyContent: 'center' },
  atalhoTexto: { fontSize: 15, fontWeight: '700', color: cores.texto },
  grupoAcoes: {
    backgroundColor: cores.superficie,
    borderRadius: raio.g,
    borderWidth: 1,
    borderColor: cores.borda,
    overflow: 'hidden',
  },
  separador: { borderTopWidth: 1, borderTopColor: cores.borda },
  linhaAcao: {
    minHeight: ALVO_TOQUE + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.g,
    paddingVertical: espaco.p,
  },
  iconeLinha: { width: 40, height: 40, borderRadius: raio.m, alignItems: 'center', justifyContent: 'center' },
  textoLinha: { flex: 1, fontSize: 17, fontWeight: '600', color: cores.texto },
});

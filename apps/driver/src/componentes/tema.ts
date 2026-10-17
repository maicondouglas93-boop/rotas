// Paleta clara de alto contraste para uso sob sol; status sempre com texto (não só cor).
export const cores = {
  fundo: '#f2f5f8',
  superficie: '#ffffff',
  superficieSuave: '#f7f9fb',
  texto: '#0b1524',
  textoSecundario: '#525d70',
  borda: '#e1e6ed',
  bordaForte: '#c7cfda',
  primaria: '#0a5a75',
  primariaEscura: '#05344a',
  primariaSuave: '#e4f0f5',
  primariaTexto: '#ffffff',
  destaque: '#5fd3e8',
  perigo: '#b42318',
  perigoFundo: '#fdeceb',
  sucesso: '#067647',
  sucessoFundo: '#e5f5eb',
  alerta: '#8a4b06',
  alertaFundo: '#fef3dc',
  info: '#1453b8',
  infoFundo: '#e8f0fd',
  neutro: '#475467',
  neutroFundo: '#eef1f5',
} as const;

/** Gradiente da marca (topo da tela inicial e do login). */
export const GRADIENTE_MARCA = ['#0d7391', '#075069', '#05344a'] as const;

export const espaco = { pp: 4, p: 8, m: 12, g: 16, gg: 24, ggg: 32 } as const;

export const raio = { p: 8, m: 12, g: 16, gg: 22, pilula: 999 } as const;

// Sombras em camadas (boxShadow da nova arquitetura): discretas, sem borda pesada.
export const sombra = {
  cartao: { boxShadow: '0px 1px 2px rgba(16, 24, 40, 0.06), 0px 6px 16px rgba(16, 24, 40, 0.06)' },
  elevada: { boxShadow: '0px 2px 4px rgba(16, 24, 40, 0.08), 0px 12px 28px rgba(16, 24, 40, 0.12)' },
  botao: { boxShadow: '0px 6px 14px rgba(10, 90, 117, 0.28)' },
} as const;

/** Alvo de toque mínimo de 48 dp (react-native-driver-app, "UX de campo"). */
export const ALVO_TOQUE = 48;

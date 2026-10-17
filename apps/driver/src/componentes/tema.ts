// Cores com contraste alto para uso sob sol; status sempre com texto (não só cor).
export const cores = {
  fundo: '#f3f4f6',
  superficie: '#ffffff',
  texto: '#111827',
  textoSecundario: '#4b5563',
  borda: '#d1d5db',
  primaria: '#0b5f7a',
  primariaTexto: '#ffffff',
  perigo: '#b91c1c',
  sucesso: '#047857',
  alerta: '#92400e',
  alertaFundo: '#fef3c7',
  infoFundo: '#e0f2fe',
  info: '#075985',
  neutroFundo: '#e5e7eb',
} as const;

export const espaco = { p: 8, m: 12, g: 16, gg: 24 } as const;

/** Alvo de toque mínimo de 48 dp (react-native-driver-app, "UX de campo"). */
export const ALVO_TOQUE = 48;

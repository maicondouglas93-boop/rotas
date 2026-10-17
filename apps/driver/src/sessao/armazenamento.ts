import AsyncStorage from '@react-native-async-storage/async-storage';
import { usuarioSessaoSchema, type UsuarioSessao } from '@rotas/shared';
import * as SecureStore from 'expo-secure-store';

// Refresh token só no armazenamento seguro do aparelho (Keystore). Nunca em AsyncStorage.
const CHAVE_REFRESH = 'rotas.refresh-token';

export function lerRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(CHAVE_REFRESH);
}

export function gravarRefreshToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(CHAVE_REFRESH, token);
}

export function apagarRefreshToken(): Promise<void> {
  return SecureStore.deleteItemAsync(CHAVE_REFRESH);
}

// Dados não sensíveis do usuário, para abrir o app sem rede (o refresh continua no SecureStore).
const CHAVE_USUARIO = 'rotas.usuario';

export async function lerUsuarioGuardado(): Promise<UsuarioSessao | null> {
  const bruto = await AsyncStorage.getItem(CHAVE_USUARIO);
  if (!bruto) return null;
  const lido = usuarioSessaoSchema.safeParse(JSON.parse(bruto));
  return lido.success ? lido.data : null;
}

export function guardarUsuario(usuario: UsuarioSessao): Promise<void> {
  return AsyncStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

export function apagarUsuarioGuardado(): Promise<void> {
  return AsyncStorage.removeItem(CHAVE_USUARIO);
}

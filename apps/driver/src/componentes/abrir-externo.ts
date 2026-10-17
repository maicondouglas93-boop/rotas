import { Alert, Linking } from 'react-native';

/**
 * Abre Waze, Google Maps ou WhatsApp pelo link https (abre o app se instalado, senão o navegador),
 * sem precisar declarar <queries> no Android. Falhou? Tenta a alternativa e, por fim, avisa.
 */
export async function abrirExterno(url: string, alternativa?: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    if (alternativa) {
      try {
        await Linking.openURL(alternativa);
        return;
      } catch {
        // segue para o aviso
      }
    }
    Alert.alert('Não foi possível abrir', 'Verifique se o aplicativo está instalado.');
  }
}

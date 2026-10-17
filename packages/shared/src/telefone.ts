/**
 * Normaliza telefone brasileiro para E.164 (+55DDDNUMERO).
 * Aceita 10–11 dígitos (DDD + número) ou 12–13 dígitos começando com 55.
 * Retorna null quando não for possível interpretar.
 */
export function normalizarTelefoneBR(entrada: string): string | null {
  let digitos = entrada.replace(/\D/g, '');
  if (digitos.length === 12 || digitos.length === 13) {
    if (!digitos.startsWith('55')) return null;
    digitos = digitos.slice(2);
  }
  if (digitos.length !== 10 && digitos.length !== 11) return null;
  if (digitos.startsWith('0')) return null;
  return `+55${digitos}`;
}

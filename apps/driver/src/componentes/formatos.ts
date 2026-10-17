const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "2026-10-17" → "17/10/2026" (data sem fuso, como vem da API). */
export function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** "Sexta-feira, 17 de outubro" no horário do aparelho. */
export function dataPorExtenso(data: Date): string {
  const texto = `${DIAS[data.getDay()]}, ${data.getDate()} de ${MESES[data.getMonth()]}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Instante ISO → "14:25" no horário do aparelho. */
export function formatarHora(iso: string): string {
  const data = new Date(iso);
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

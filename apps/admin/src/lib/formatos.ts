// Formatação para exibição (pt-BR, America/Sao_Paulo). Valores enviados à API não passam por aqui.

const FUSO = 'America/Sao_Paulo';
const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: FUSO });
const hora = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short', timeZone: FUSO });

/** `AAAA-MM-DD` → `DD/MM/AAAA` (data sem hora, sem conversão de fuso). */
export function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataHora(iso: string | null): string {
  return iso ? dataHora.format(new Date(iso)) : '—';
}

export function formatarHora(iso: string | null): string {
  return iso ? hora.format(new Date(iso)) : '—';
}

/** Data de hoje em `AAAA-MM-DD` no fuso de São Paulo. */
export function hoje(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
}

/** `+5511987654321` → `(11) 98765-4321`. */
export function formatarTelefone(e164: string | null): string {
  if (!e164) return '—';
  const d = e164.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return e164;
}

export function formatarCep(cep: string): string {
  return cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep;
}

const dataExtenso = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** `AAAA-MM-DD` → "Sexta-feira, 17 de outubro" (data sem hora: formatada em UTC para não mudar o dia). */
export function formatarDataPorExtenso(data: string): string {
  const texto = dataExtenso.format(new Date(`${data}T12:00:00Z`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Tempo decorrido em texto curto: "agora há pouco", "há 12 min", "há 2 h", "há 3 dias". */
export function formatarHaQuanto(iso: string, agora: number): string {
  const minutos = Math.floor((agora - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'agora há pouco';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

// Únicos construtores de links externos do projeto (skill maps-route-planning).

export type Destino = {
  latitude?: number | null;
  longitude?: number | null;
  enderecoFormatado: string;
};

function temCoordenada(d: Destino): d is Destino & { latitude: number; longitude: number } {
  return d.latitude != null && d.longitude != null;
}

function coordenada(valor: number): string {
  return String(Number(valor.toFixed(6)));
}

export function linkWaze(d: Destino): string {
  if (temCoordenada(d)) {
    return `https://waze.com/ul?ll=${coordenada(d.latitude)},${coordenada(d.longitude)}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(d.enderecoFormatado)}&navigate=yes`;
}

export function linkGoogleMaps(d: Destino): string {
  const destino = temCoordenada(d)
    ? `${coordenada(d.latitude)},${coordenada(d.longitude)}`
    : d.enderecoFormatado;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}&travelmode=driving`;
}

export function linkWhatsApp(telefoneE164: string, mensagem?: string): string {
  const digitos = telefoneE164.replace(/\D/g, '');
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : '';
  return `https://wa.me/${digitos}${texto}`;
}

export type Endereco = {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
};

/** "Logradouro, número – Bairro, Cidade – UF, CEP". Sem complemento, que atrapalha a busca do navegador. */
export function formatarEndereco(e: Endereco): string {
  const cep = e.cep.replace(/\D/g, '');
  const cepFormatado = cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep;
  return `${e.logradouro}, ${e.numero} – ${e.bairro}, ${e.cidade} – ${e.uf.toUpperCase()}, ${cepFormatado}`;
}

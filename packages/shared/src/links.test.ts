import { describe, expect, it } from 'vitest';
import { formatarEndereco, linkGoogleMaps, linkWaze, linkWhatsApp } from './links.js';

const comCoordenada = { latitude: -23.5505199, longitude: -46.6333094, enderecoFormatado: 'qualquer' };
const semCoordenada = {
  latitude: null,
  longitude: null,
  enderecoFormatado: 'Rua São Bento, 100 – Centro, São Paulo – SP, 01011-100',
};

describe('linkWaze', () => {
  it('usa coordenadas com 6 casas quando existem', () => {
    expect(linkWaze(comCoordenada)).toBe('https://waze.com/ul?ll=-23.55052,-46.633309&navigate=yes');
  });

  it('usa o endereço codificado quando não há coordenadas', () => {
    expect(linkWaze(semCoordenada)).toBe(
      `https://waze.com/ul?q=${encodeURIComponent(semCoordenada.enderecoFormatado)}&navigate=yes`,
    );
  });

  it('codifica caracteres especiais do endereço', () => {
    const url = linkWaze({ enderecoFormatado: 'Av. Brasil, 10 #2 / fundos' });
    expect(url).not.toContain('#');
    expect(url).toContain('%23');
    expect(url).toContain('%2F');
  });

  it('trata latitude 0 como coordenada válida', () => {
    expect(linkWaze({ latitude: 0, longitude: 0, enderecoFormatado: 'x' })).toContain('ll=0,0');
  });
});

describe('linkGoogleMaps', () => {
  it('monta rota de carro até a coordenada', () => {
    expect(linkGoogleMaps(comCoordenada)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-23.55052%2C-46.633309&travelmode=driving',
    );
  });

  it('usa o endereço quando não há coordenadas', () => {
    expect(linkGoogleMaps(semCoordenada)).toContain(encodeURIComponent('Rua São Bento'));
  });
});

describe('linkWhatsApp', () => {
  it('remove o + e mantém só dígitos', () => {
    expect(linkWhatsApp('+5511987654321')).toBe('https://wa.me/5511987654321');
  });

  it('codifica a mensagem opcional', () => {
    expect(linkWhatsApp('+5511987654321', 'Olá, tudo bem?')).toBe(
      `https://wa.me/5511987654321?text=${encodeURIComponent('Olá, tudo bem?')}`,
    );
  });
});

describe('formatarEndereco', () => {
  it('formata sem complemento e com CEP pontuado', () => {
    expect(
      formatarEndereco({
        logradouro: 'Rua São Bento',
        numero: '100',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'sp',
        cep: '01011100',
      }),
    ).toBe('Rua São Bento, 100 – Centro, São Paulo – SP, 01011-100');
  });
});

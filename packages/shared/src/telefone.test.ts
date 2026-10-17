import { describe, expect, it } from 'vitest';
import { normalizarTelefoneBR } from './telefone.js';

describe('normalizarTelefoneBR', () => {
  it.each([
    ['(11) 98765-4321', '+5511987654321'],
    ['11987654321', '+5511987654321'],
    ['1133334444', '+551133334444'],
    ['+55 11 98765-4321', '+5511987654321'],
    ['5511987654321', '+5511987654321'],
    ['551133334444', '+551133334444'],
  ])('%s => %s', (entrada, esperado) => {
    expect(normalizarTelefoneBR(entrada)).toBe(esperado);
  });

  it.each(['', '987654321', '011987654321', '4411987654321', 'abc', '119876543210000'])(
    'rejeita %s',
    (entrada) => {
      expect(normalizarTelefoneBR(entrada)).toBeNull();
    },
  );
});

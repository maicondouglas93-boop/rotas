import { randomInt } from 'node:crypto';

// Sem caracteres que se confundem ao ditar ou ler (0/O, 1/l/I).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const BLOCOS = 3;
const TAMANHO_BLOCO = 4;

/**
 * Gera uma senha temporária legível no formato `Xxxx-Xxxx-Xxxx` (12 caracteres aleatórios,
 * cerca de 69 bits de entropia). O motorista é obrigado a trocá-la no primeiro acesso.
 */
export function gerarSenhaTemporaria(): string {
  const blocos: string[] = [];
  for (let b = 0; b < BLOCOS; b++) {
    let bloco = '';
    for (let i = 0; i < TAMANHO_BLOCO; i++) bloco += ALFABETO[randomInt(ALFABETO.length)];
    blocos.push(bloco);
  }
  return blocos.join('-');
}

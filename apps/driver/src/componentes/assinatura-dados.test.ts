import { caminhoAssinaturaSvg } from '@rotas/shared';
import { adicionarPonto, novoTraco } from './assinatura-dados';

describe('dados da assinatura', () => {
  it('arredonda e mantém os pontos dentro da área', () => {
    expect(novoTraco(10.6, -5, 300, 150)).toEqual([11, 0]);
    expect(adicionarPonto([11, 0], 400, 200, 300, 150)).toEqual([11, 0, 300, 150]);
  });

  it('ignora ponto quase em cima do anterior', () => {
    expect(adicionarPonto([10, 10], 11, 10, 300, 150)).toEqual([10, 10]);
    expect(adicionarPonto([10, 10], 13, 10, 300, 150)).toEqual([10, 10, 13, 10]);
  });

  it('não passa do teto de coordenadas por traço', () => {
    const cheio = Array.from({ length: 4000 }, (_, i) => i % 300);
    expect(adicionarPonto(cheio, 1, 1, 300, 150)).toBe(cheio);
  });

  it('gera o caminho SVG, inclusive para um toque sem movimento', () => {
    expect(caminhoAssinaturaSvg([10, 10, 50, 60, 90, 40])).toBe('M 10 10 L 50 60 L 90 40');
    expect(caminhoAssinaturaSvg([20, 30])).toBe('M 20 30 L 20.1 30.1');
  });
});

// Traços da assinatura: [x1, y1, x2, y2, …] em pixels inteiros dentro da área de desenho.
// Mesmo formato que a API valida (assinaturaSchema) e que o painel redesenha em SVG.

/** Distância mínima entre pontos seguidos: mão parada não gera ponto repetido. */
const DISTANCIA_MINIMA = 2;
/** Teto por traço (a API aceita até 4000 coordenadas). */
const MAXIMO_COORDENADAS = 4000;

const limitar = (valor: number, maximo: number) => Math.min(Math.max(Math.round(valor), 0), maximo);

export function novoTraco(x: number, y: number, largura: number, altura: number): number[] {
  return [limitar(x, largura), limitar(y, altura)];
}

/** Devolve o mesmo traço quando o ponto é perto demais do anterior ou o traço já está cheio. */
export function adicionarPonto(traco: number[], x: number, y: number, largura: number, altura: number): number[] {
  if (traco.length >= MAXIMO_COORDENADAS) return traco;
  const px = limitar(x, largura);
  const py = limitar(y, altura);
  const ux = traco[traco.length - 2] ?? px;
  const uy = traco[traco.length - 1] ?? py;
  if (Math.hypot(px - ux, py - uy) < DISTANCIA_MINIMA) return traco;
  return [...traco, px, py];
}

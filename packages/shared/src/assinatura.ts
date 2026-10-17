/**
 * Caminho SVG de um traço de assinatura ([x1, y1, x2, y2, …]); um toque sem movimento vira um ponto
 * visível. Usado pelo app (ao assinar) e pelo painel (ao exibir o comprovante).
 */
export function caminhoAssinaturaSvg(traco: readonly number[]): string {
  const [x0 = 0, y0 = 0] = traco;
  if (traco.length <= 2) return `M ${x0} ${y0} L ${x0 + 0.1} ${y0 + 0.1}`;
  let caminho = `M ${x0} ${y0}`;
  for (let i = 2; i < traco.length; i += 2) caminho += ` L ${traco[i]} ${traco[i + 1]}`;
  return caminho;
}

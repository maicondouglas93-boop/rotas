import { ErroApi } from '@rotas/shared';

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroApi) return erro.message;
  return 'Algo deu errado. Tente novamente.';
}

/**
 * Leva os erros por campo da API (`erro.detalhes`) para o formulário, via `definir` (ex.: `form.setError`).
 * Devolve `true` se algum campo recebeu erro; senão o chamador mostra a mensagem geral.
 */
export function aplicarErrosDaApi(
  erro: unknown,
  definir: (caminho: string, erro: { type: string; message: string }) => void,
): boolean {
  if (!(erro instanceof ErroApi) || erro.detalhes.length === 0) return false;
  for (const detalhe of erro.detalhes) {
    if (detalhe.caminho) definir(detalhe.caminho, { type: 'api', message: detalhe.mensagem });
  }
  return true;
}

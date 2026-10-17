// Armazenamento de arquivos privados (fotos de comprovante). Decisão em docs/adr/0001-armazenamento-comprovantes.md.

export interface ArmazenamentoArquivos {
  salvar(chave: string, conteudo: Buffer): Promise<void>;
  apagar(chave: string): Promise<void>;
  /** Link de leitura assinado, válido por `segundos`; caminho da API (`/api/v1/...`) ou URL completa. */
  urlLeitura(chave: string, segundos: number): string;
}

export const ARMAZENAMENTO = Symbol('ARMAZENAMENTO');

/** Validade dos links de foto entregues ao painel. */
export const VALIDADE_LINK_SEGUNDOS = 300;

/** `comprovantes/<rotaId>/<uuid>.jpg`: chave aleatória, sem nome de arquivo vindo do cliente. */
export const CHAVE_COMPROVANTE = /^comprovantes\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;

export function chaveComprovante(rotaId: string, id: string): string {
  return `comprovantes/${rotaId}/${id}.jpg`;
}

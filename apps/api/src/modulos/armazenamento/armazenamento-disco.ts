import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { PREFIXO_API } from '../../configurar-app.js';
import { CHAVE_COMPROVANTE, type ArmazenamentoArquivos } from './armazenamento.js';

/**
 * Arquivos numa pasta local, servidos pela própria API com link assinado (HMAC) e prazo curto.
 * Só para desenvolvimento e testes: no Render o disco é apagado a cada deploy (ver ADR 0001).
 */
@Injectable()
export class ArmazenamentoEmDisco implements ArmazenamentoArquivos {
  private readonly pasta: string;
  private readonly segredo: Buffer;

  constructor(@Inject(ENV) env: Env) {
    this.pasta = path.resolve(env.ARMAZENAMENTO_PASTA);
    // Chave própria, derivada do segredo do JWT: um link de arquivo nunca vale como token de acesso.
    this.segredo = createHmac('sha256', env.JWT_SECRET).update('rotas:armazenamento-arquivos').digest();
  }

  async salvar(chave: string, conteudo: Buffer): Promise<void> {
    const destino = this.caminho(chave);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, conteudo);
  }

  async apagar(chave: string): Promise<void> {
    await rm(this.caminho(chave), { force: true });
  }

  urlLeitura(chave: string, segundos: number): string {
    const expira = Math.floor(Date.now() / 1000) + segundos;
    return `/${PREFIXO_API}/arquivos/${chave}?expira=${expira}&assinatura=${this.assinar(chave, expira)}`;
  }

  /** Link válido: assinatura confere (comparação em tempo constante) e prazo não venceu. */
  linkValido(chave: string, expira: number, assinatura: string): boolean {
    if (!CHAVE_COMPROVANTE.test(chave) || expira < Math.floor(Date.now() / 1000)) return false;
    const esperada = Buffer.from(this.assinar(chave, expira));
    const recebida = Buffer.from(assinatura);
    return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
  }

  /** `null` quando o arquivo não existe mais. */
  async ler(chave: string): Promise<Buffer | null> {
    try {
      return await readFile(this.caminho(chave));
    } catch {
      return null;
    }
  }

  private assinar(chave: string, expira: number): string {
    return createHmac('sha256', this.segredo).update(`${chave}:${expira}`).digest('base64url');
  }

  /** A chave segue um formato fixo (sem `..`), então o caminho nunca sai da pasta. */
  private caminho(chave: string): string {
    if (!CHAVE_COMPROVANTE.test(chave)) throw new Error('Chave de arquivo inválida.');
    return path.join(this.pasta, ...chave.split('/'));
  }
}

import { Controller, Get, Header, Param, Query, StreamableFile } from '@nestjs/common';
import { z } from 'zod';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';
import { ZodPipe } from '../../comum/pipes/zod.pipe.js';
import { Publico } from '../auth/decoradores.js';
import { ArmazenamentoEmDisco } from './armazenamento-disco.js';
import { VALIDADE_LINK_SEGUNDOS } from './armazenamento.js';

const linkSchema = z.object({ expira: z.coerce.number().int(), assinatura: z.string().min(10).max(100) }).strict();

/**
 * Entrega arquivos do armazenamento em disco por link assinado. Sem token: o link é a credencial
 * (prazo curto, gerado só para o admin). Link inválido ou vencido responde 404, sem dizer o motivo.
 */
@Controller('arquivos')
@Publico()
export class ArquivosController {
  constructor(private readonly armazenamento: ArmazenamentoEmDisco) {}

  @Get('comprovantes/:rotaId/:arquivo')
  @Header('Cache-Control', `private, max-age=${VALIDADE_LINK_SEGUNDOS}`)
  // O painel fica em outra origem: a imagem precisa poder ser exibida lá (helmet bloqueia por padrão).
  @Header('Cross-Origin-Resource-Policy', 'cross-site')
  async ler(
    @Param('rotaId') rotaId: string,
    @Param('arquivo') arquivo: string,
    @Query(new ZodPipe(linkSchema)) link: z.infer<typeof linkSchema>,
  ): Promise<StreamableFile> {
    const chave = `comprovantes/${rotaId}/${arquivo}`;
    const conteudo = this.armazenamento.linkValido(chave, link.expira, link.assinatura)
      ? await this.armazenamento.ler(chave)
      : null;
    if (!conteudo) throw ErroDominio.naoEncontrado('Arquivo não encontrado ou link vencido.');
    return new StreamableFile(conteudo, { type: 'image/jpeg', disposition: 'inline' });
  }
}

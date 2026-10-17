import { Global, Module } from '@nestjs/common';
import { ArmazenamentoEmDisco } from './armazenamento-disco.js';
import { ARMAZENAMENTO } from './armazenamento.js';
import { ArquivosController } from './arquivos.controller.js';

/** Hoje só o disco (dev/teste). Antes de publicar, entra o S3/R2 atrás do mesmo token (ADR 0001). */
@Global()
@Module({
  controllers: [ArquivosController],
  providers: [ArmazenamentoEmDisco, { provide: ARMAZENAMENTO, useExisting: ArmazenamentoEmDisco }],
  exports: [ARMAZENAMENTO],
})
export class ArmazenamentoModule {}

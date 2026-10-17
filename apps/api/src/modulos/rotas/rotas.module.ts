import { Module } from '@nestjs/common';
import { RotasAdminController } from './rotas-admin.controller.js';
import { RotasComandosService } from './rotas-comandos.service.js';
import { RotasEdicaoService } from './rotas-edicao.service.js';
import { RotasService } from './rotas.service.js';

@Module({
  controllers: [RotasAdminController],
  providers: [RotasService, RotasEdicaoService, RotasComandosService],
  exports: [RotasService],
})
export class RotasModule {}

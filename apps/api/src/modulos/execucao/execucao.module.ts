import { Module } from '@nestjs/common';
import { IdempotenciaService } from '../../comum/idempotencia/idempotencia.js';
import { ExecucaoService } from './execucao.service.js';
import { MotoristaRotasController } from './motorista-rotas.controller.js';

@Module({
  controllers: [MotoristaRotasController],
  providers: [ExecucaoService, IdempotenciaService],
})
export class ExecucaoModule {}

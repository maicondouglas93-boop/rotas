import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MotoristasController } from './motoristas.controller.js';
import { MotoristasService } from './motoristas.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MotoristasController],
  providers: [MotoristasService],
  exports: [MotoristasService],
})
export class MotoristasModule {}

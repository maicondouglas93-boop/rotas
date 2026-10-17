import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { PublicarEventosInterceptor } from './publicar-eventos.interceptor.js';
import { TempoRealGateway } from './tempo-real.gateway.js';
import { TempoRealService } from './tempo-real.service.js';

@Module({
  imports: [AuthModule],
  providers: [
    TempoRealService,
    TempoRealGateway,
    { provide: APP_INTERCEPTOR, useClass: PublicarEventosInterceptor },
  ],
  exports: [TempoRealService],
})
export class TempoRealModule {}

import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ExcecoesFilter } from './comum/filtros/excecoes.filter.js';
import { requestIdMiddleware } from './comum/request-id.middleware.js';
import { ConfigModule } from './config/config.module.js';
import { AuthModule } from './modulos/auth/auth.module.js';
import { EmpresasModule } from './modulos/empresas/empresas.module.js';
import { MotoristasModule } from './modulos/motoristas/motoristas.module.js';
import { RotasModule } from './modulos/rotas/rotas.module.js';
import { SaudeModule } from './modulos/saude/saude.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, SaudeModule, EmpresasModule, MotoristasModule, RotasModule],
  providers: [{ provide: APP_FILTER, useClass: ExcecoesFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes('*');
  }
}

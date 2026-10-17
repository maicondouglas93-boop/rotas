import { Global, Module } from '@nestjs/common';
import { carregarEnv, ENV } from './env.js';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => carregarEnv() }],
  exports: [ENV],
})
export class ConfigModule {}

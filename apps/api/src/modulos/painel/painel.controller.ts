import { Controller, Get, Query } from '@nestjs/common';
import { filtroPainelHojeSchema, type FiltroPainelHoje, type PainelHoje } from '@rotas/shared';
import { ZodPipe } from '../../comum/pipes/zod.pipe.js';
import { Perfis } from '../auth/decoradores.js';
import { PainelService } from './painel.service.js';

@Controller('painel')
@Perfis('ADMIN')
export class PainelController {
  constructor(private readonly painel: PainelService) {}

  @Get('hoje')
  hoje(@Query(new ZodPipe(filtroPainelHojeSchema)) filtro: FiltroPainelHoje): Promise<PainelHoje> {
    return this.painel.hoje(filtro);
  }
}

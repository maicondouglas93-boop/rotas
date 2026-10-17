import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { Publico } from '../auth/decoradores.js';
import { SaudeService } from './saude.service.js';

@Controller('saude')
@Publico()
export class SaudeController {
  constructor(private readonly saude: SaudeService) {}

  /** Processo vivo. Não toca no banco: usado pelo health check da Render. */
  @Get()
  @HttpCode(HttpStatus.OK)
  vivo() {
    return { status: 'ok', versao: this.saude.versao() };
  }

  /** Pronto para atender: confirma acesso ao banco. */
  @Get('pronto')
  async pronto() {
    if (!(await this.saude.bancoDisponivel())) {
      throw new ServiceUnavailableException();
    }
    return { status: 'ok', versao: this.saude.versao() };
  }
}

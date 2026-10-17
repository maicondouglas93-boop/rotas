import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { SaudeService } from './saude.service.js';

// Rotas públicas (receberão @Publico() quando o guard JWT global for criado).
@Controller('saude')
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

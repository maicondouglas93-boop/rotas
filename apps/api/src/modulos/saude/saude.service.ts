import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

const TIMEOUT_BANCO_MS = 2000;

@Injectable()
export class SaudeService {
  constructor(private readonly prisma: PrismaService) {}

  versao(): string {
    return process.env['RENDER_GIT_COMMIT']?.slice(0, 7) ?? 'dev';
  }

  async bancoDisponivel(): Promise<boolean> {
    let temporizador: NodeJS.Timeout | undefined;
    const limite = new Promise<false>((resolve) => {
      temporizador = setTimeout(() => resolve(false), TIMEOUT_BANCO_MS);
    });
    try {
      const consulta = this.prisma.$queryRaw`SELECT 1`.then(() => true as const);
      return await Promise.race([consulta, limite]);
    } catch {
      return false;
    } finally {
      clearTimeout(temporizador);
    }
  }
}

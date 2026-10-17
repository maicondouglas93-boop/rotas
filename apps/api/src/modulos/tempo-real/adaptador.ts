import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

/** Socket.IO no mesmo servidor HTTP, com as mesmas origens permitidas do CORS da API. */
export class AdaptadorTempoReal extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origens: string[],
  ) {
    super(app);
  }

  override createIOServer(porta: number, opcoes?: ServerOptions): Server {
    const comCors = { ...opcoes, serveClient: false, cors: { origin: this.origens, credentials: true } } as ServerOptions;
    return super.createIOServer(porta, comCors) as Server;
  }
}

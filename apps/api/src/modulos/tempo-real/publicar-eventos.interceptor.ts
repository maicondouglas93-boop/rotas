import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { comColetaDeEventos, type EventoColetado } from './coletor.js';
import { TempoRealService } from './tempo-real.service.js';

/**
 * Em toda requisição que altera dados, coleta os eventos gravados no histórico e, quando o handler
 * termina bem (transação confirmada), publica no Socket.IO. Erro → nada é publicado.
 */
@Injectable()
export class PublicarEventosInterceptor implements NestInterceptor {
  constructor(private readonly tempoReal: TempoRealService) {}

  intercept(contexto: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (contexto.getType() !== 'http' || contexto.switchToHttp().getRequest<Request>().method === 'GET') {
      return next.handle();
    }
    const eventos: EventoColetado[] = [];
    return new Observable((assinante) =>
      comColetaDeEventos(eventos, () =>
        next
          .handle()
          .pipe(tap({ next: () => void this.tempoReal.publicar(eventos) }))
          .subscribe(assinante),
      ),
    );
  }
}

import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const ID_VALIDO = /^[A-Za-z0-9._-]{8,100}$/;

/** Usa o x-request-id recebido (se tiver formato seguro) ou gera um novo, e o devolve na resposta. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const recebido = req.header('x-request-id');
  const id = recebido && ID_VALIDO.test(recebido) ? recebido : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

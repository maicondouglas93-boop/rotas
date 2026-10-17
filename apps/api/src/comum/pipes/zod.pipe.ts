import { Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { ErroDominio } from '../erros/erro-dominio.js';

@Injectable()
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(valor: unknown): z.infer<T> {
    const resultado = this.schema.safeParse(valor);
    if (!resultado.success) throw ErroDominio.validacao(resultado.error.issues);
    return resultado.data;
  }
}

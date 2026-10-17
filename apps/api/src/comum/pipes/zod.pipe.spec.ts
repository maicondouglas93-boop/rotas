import { CodigoErro } from '@rotas/shared';
import { z } from 'zod';
import { ErroDominio } from '../erros/erro-dominio.js';
import { ZodPipe } from './zod.pipe.js';

const schema = z.object({ nome: z.string().min(2), paradas: z.array(z.uuid()).max(2) }).strict();

describe('ZodPipe', () => {
  const pipe = new ZodPipe(schema);

  it('devolve os dados validados', () => {
    expect(pipe.transform({ nome: 'Centro', paradas: [] })).toEqual({ nome: 'Centro', paradas: [] });
  });

  it('lança VALIDACAO com o caminho de cada campo inválido', () => {
    try {
      pipe.transform({ nome: 'x', paradas: ['nao-e-uuid'] });
      expect.unreachable();
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      const e = erro as ErroDominio;
      expect(e.codigo).toBe(CodigoErro.VALIDACAO);
      expect(e.status).toBe(400);
      expect(e.detalhes.map((d) => d.caminho)).toEqual(['nome', 'paradas.0']);
    }
  });

  it('rejeita campos não declarados (atribuição em massa)', () => {
    expect(() => pipe.transform({ nome: 'Centro', paradas: [], status: 'CONCLUIDA' })).toThrow(ErroDominio);
  });
});

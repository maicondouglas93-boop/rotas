import { SenhasService } from '../auth/senhas.service.js';
import { gerarSenhaTemporaria } from './senha-temporaria.js';

describe('gerarSenhaTemporaria', () => {
  it('gera no formato Xxxx-Xxxx-Xxxx sem caracteres ambíguos', () => {
    for (let i = 0; i < 200; i++) {
      const senha = gerarSenhaTemporaria();
      expect(senha).toMatch(/^[A-HJ-NP-Za-hj-km-np-z2-9]{4}-[A-HJ-NP-Za-hj-km-np-z2-9]{4}-[A-HJ-NP-Za-hj-km-np-z2-9]{4}$/);
    }
  });

  it('não repete em mil gerações', () => {
    const geradas = new Set(Array.from({ length: 1000 }, gerarSenhaTemporaria));
    expect(geradas.size).toBe(1000);
  });

  it('respeita a política de senha usada na troca', () => {
    const senhas = new SenhasService();
    expect(() => senhas.validarPoliticaNovaSenha(gerarSenhaTemporaria(), 'motorista@exemplo.com')).not.toThrow();
  });
});

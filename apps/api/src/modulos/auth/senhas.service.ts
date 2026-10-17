import { Injectable } from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';
import { ErroDominio } from '../../comum/erros/erro-dominio.js';

const SENHAS_COMUNS = new Set<string>([
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  '00000000',
  '11111111',
  '22222222',
  '12341234',
  '123123123',
  'senha123',
  'senha1234',
  'minhasenha',
  'mudar123',
  'trocar123',
  'admin123',
  'admin1234',
  'rotas123',
  'entrega123',
  'motorista1',
  'password',
  'password1',
  'password123',
  'qwerty123',
  'qwertyui',
  'abcd1234',
  'iloveyou',
  'brasil123',
]);

@Injectable()
export class SenhasService {
  private readonly promessaHashFalso: Promise<string>;

  constructor() {
    // Pré-calcula um hash Argon2id real na inicialização para manter tempo de resposta
    // equivalente quando o e-mail informado no login não existir.
    this.promessaHashFalso = hash('senha-ficticia-para-tempo-constante-rotas', {
      type: argon2id,
    });
  }

  async gerarHash(senha: string): Promise<string> {
    return hash(senha, { type: argon2id });
  }

  /**
   * Verifica a senha contra `hashGravado`. Quando `hashGravado` é `null` (usuário inexistente),
   * executa a verificação contra o hash falso com os mesmos parâmetros Argon2id e devolve `false`.
   */
  async verificar(hashGravado: string | null, senha: string): Promise<boolean> {
    const alvo = hashGravado ?? (await this.promessaHashFalso);
    try {
      const corresponde = await verify(alvo, senha);
      return hashGravado !== null && corresponde;
    } catch {
      return false;
    }
  }

  validarPoliticaNovaSenha(novaSenha: string, emailUsuario: string): void {
    if (novaSenha.length < 8 || novaSenha.length > 128) {
      throw ErroDominio.regraNegocio('A nova senha deve ter entre 8 e 128 caracteres.');
    }

    const senhaMinuscula = novaSenha.toLowerCase();
    const senhaNormalizada = novaSenha.trim().toLowerCase();
    const emailNormalizado = emailUsuario.trim().toLowerCase();

    if (
      emailNormalizado.length > 0 &&
      (senhaMinuscula === emailNormalizado || senhaNormalizada === emailNormalizado)
    ) {
      throw ErroDominio.regraNegocio('A nova senha não pode ser igual ao e-mail.');
    }

    if (SENHAS_COMUNS.has(senhaMinuscula) || SENHAS_COMUNS.has(senhaNormalizada)) {
      throw ErroDominio.regraNegocio('Esta senha é muito comum. Escolha uma senha mais segura.');
    }
  }
}

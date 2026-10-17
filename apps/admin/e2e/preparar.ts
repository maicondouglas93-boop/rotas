import { execSync } from 'node:child_process';
import { ADMIN_E2E, ambienteApi, RAIZ } from './ambiente';

/** Antes de todos os testes: migrations, banco de teste zerado e só o administrador do seed. */
export default function preparar(): void {
  const env = { ...process.env, ...ambienteApi, SEED_ADMIN_EMAIL: ADMIN_E2E.email, SEED_ADMIN_SENHA: ADMIN_E2E.senha };
  const rodar = (comando: string) => execSync(comando, { cwd: RAIZ, env, stdio: 'inherit' });
  rodar('pnpm --filter api exec prisma migrate deploy');
  rodar('pnpm --filter api db:limpar-teste');
  rodar('pnpm --filter api db:seed');
}

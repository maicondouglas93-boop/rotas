import { expect, test } from '@playwright/test';
import { entrarComoAdmin } from './apoio';
import { ADMIN_E2E } from './ambiente';

test.describe('login do painel', () => {
  test('senha errada mostra o erro e continua no login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail', { exact: true }).fill(ADMIN_E2E.email);
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada-123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha inválidos.' })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('página do painel sem sessão leva ao login e volta depois de entrar', async ({ page }) => {
    await page.goto('/empresas');
    await expect(page).toHaveURL(/\/login\?volta=%2Fempresas$/);
    await page.getByLabel('E-mail', { exact: true }).fill(ADMIN_E2E.email);
    await page.getByLabel('Senha', { exact: true }).fill(ADMIN_E2E.senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/empresas$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Empresas' })).toBeVisible();
  });

  test('entra, mostra as rotas e sai', async ({ page }) => {
    await entrarComoAdmin(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Rotas' })).toBeVisible();
    await page.getByRole('button', { name: 'Sair' }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });
});

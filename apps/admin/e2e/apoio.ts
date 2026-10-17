import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { rotaSchema, type Rota } from '@rotas/shared';
import { ADMIN_E2E, URL_API } from './ambiente';

/** Sufixo para os dados de cada teste não colidirem (o banco é zerado só no início). */
export const sufixo = (): string => randomUUID().slice(0, 8);

export async function entrarComoAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill(ADMIN_E2E.email);
  await page.getByLabel('Senha', { exact: true }).fill(ADMIN_E2E.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/hoje$/);
}

export async function cadastrarEmpresa(page: Page, nome: string): Promise<void> {
  await page.goto('/empresas/nova');
  await page.getByLabel('Nome fantasia', { exact: true }).fill(nome);
  await page.getByLabel('Telefone', { exact: true }).fill('(11) 3333-4444');
  await page.getByLabel('CEP', { exact: true }).fill('01310-100');
  await page.getByLabel('Rua / avenida', { exact: true }).fill('Avenida Paulista');
  await page.getByLabel('Número', { exact: true }).fill('900');
  await page.getByLabel('Bairro', { exact: true }).fill('Bela Vista');
  await page.getByLabel('Cidade', { exact: true }).fill('São Paulo');
  await page.getByLabel('UF', { exact: true }).fill('SP');
  await page.getByRole('button', { name: 'Salvar empresa' }).click();
  await expect(page).toHaveURL(/\/empresas\/[0-9a-f-]{36}$/);
}

/** Cadastra pelo painel e devolve a senha temporária mostrada uma única vez. */
export async function cadastrarMotorista(page: Page, nome: string, email: string): Promise<string> {
  await page.goto('/motoristas/novo');
  await page.getByLabel('Nome', { exact: true }).fill(nome);
  await page.getByLabel('E-mail de acesso', { exact: true }).fill(email);
  await page.getByLabel('Telefone', { exact: true }).fill('(11) 98888-7777');
  await page.getByRole('button', { name: 'Cadastrar e gerar senha' }).click();
  const dialogo = page.getByRole('dialog');
  const senha = (await dialogo.locator('code').innerText()).trim();
  expect(senha.length).toBeGreaterThanOrEqual(8);
  await dialogo.getByRole('button', { name: 'Já anotei a senha' }).click();
  return senha;
}

export async function adicionarEmpresaNaRota(page: Page, nome: string): Promise<void> {
  await page.getByLabel('Adicionar empresa à rota').fill(nome);
  await page.getByRole('list', { name: 'Empresas encontradas' }).getByRole('button', { name: new RegExp(nome) }).click();
}

/** Motorista entra pelo "app" (API), troca a senha temporária e devolve o access token. */
export async function prepararMotorista(request: APIRequestContext, email: string, senhaTemporaria: string): Promise<string> {
  const login = await request.post(`${URL_API}/auth/login`, { data: { email, senha: senhaTemporaria, cliente: 'app' } });
  expect(login.ok(), await login.text()).toBe(true);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const troca = await request.post(`${URL_API}/auth/trocar-senha`, {
    data: { senhaAtual: senhaTemporaria, novaSenha: 'MotoristaE2e#Teste2026' },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(troca.ok(), await troca.text()).toBe(true);
  return accessToken;
}

/** Comando do motorista como o app envia: com Idempotency-Key. */
export async function comandoMotorista(
  request: APIRequestContext,
  token: string,
  caminho: string,
  corpo: Record<string, unknown> = {},
): Promise<Rota> {
  const res = await request.post(`${URL_API}/motorista/${caminho}`, {
    data: corpo,
    headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': randomUUID() },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return rotaSchema.parse(await res.json());
}

export async function rotaDoMotorista(request: APIRequestContext, token: string, rotaId: string): Promise<Rota> {
  const res = await request.get(`${URL_API}/motorista/rotas/${rotaId}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.ok(), await res.text()).toBe(true);
  return rotaSchema.parse(await res.json());
}

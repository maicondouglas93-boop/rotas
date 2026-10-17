import { expect, test, type Page } from '@playwright/test';
import {
  adicionarEmpresaNaRota,
  cadastrarEmpresa,
  cadastrarMotorista,
  comandoMotorista,
  entrarComoAdmin,
  prepararMotorista,
  rotaDoMotorista,
  sufixo,
} from './apoio';

const paradaNaTela = (page: Page, empresa: string) =>
  page.getByRole('region', { name: 'Paradas' }).getByRole('listitem').filter({ hasText: empresa }).first();

test('admin cadastra, monta e envia a rota e acompanha a execução do motorista ao vivo', async ({ page, request }) => {
  const s = sufixo();
  const padaria = `Padaria E2E ${s}`;
  const mercado = `Mercado E2E ${s}`;
  const nomeMotorista = `Motorista E2E ${s}`;
  const emailMotorista = `motorista.${s}@rotas.test`;
  const nomeRota = `Rota E2E ${s}`;

  await entrarComoAdmin(page);
  await cadastrarEmpresa(page, padaria);
  await cadastrarEmpresa(page, mercado);
  const senhaTemporaria = await cadastrarMotorista(page, nomeMotorista, emailMotorista);

  await test.step('monta a rota: duas paradas, coleta e entrega na primeira', async () => {
    await page.goto('/rotas/nova');
    await page.getByLabel('Nome da rota').fill(nomeRota);
    await page.getByLabel('Motorista').selectOption({ label: nomeMotorista });
    await adicionarEmpresaNaRota(page, padaria);
    await adicionarEmpresaNaRota(page, mercado);
    await page.getByRole('group', { name: 'Serviços da parada 1' }).getByRole('button', { name: 'Coleta' }).click();
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(page).toHaveURL(/\/rotas\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Rascunho');
  });
  const rotaId = page.url().split('/').pop()!;
  const titulo = page.getByRole('heading', { level: 1 });

  await test.step('envia ao motorista', async () => {
    await page.getByRole('button', { name: 'Enviar ao motorista' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Enviar ao motorista' }).click();
    await expect(titulo).toContainText('Enviada');
  });

  // Daqui em diante a página não é recarregada: tudo chega pelo tempo real.
  await expect(page.getByText('Ao vivo', { exact: true }).first()).toBeVisible();
  const token = await prepararMotorista(request, emailMotorista, senhaTemporaria);

  await test.step('motorista confirma e inicia', async () => {
    await comandoMotorista(request, token, `rotas/${rotaId}/confirmar-recebimento`);
    await expect(titulo).toContainText('Recebida');
    await comandoMotorista(request, token, `rotas/${rotaId}/iniciar`);
    await expect(titulo).toContainText('Em andamento');
  });

  const rota = await rotaDoMotorista(request, token, rotaId);
  const [p1, p2] = rota.paradas;
  const coleta = p1!.servicos.find((x) => x.tipo === 'COLETA')!;
  const entrega = p1!.servicos.find((x) => x.tipo === 'ENTREGA')!;

  await test.step('primeira parada: a caminho, no local, ocorrência e serviços', async () => {
    await comandoMotorista(request, token, `paradas/${p1!.id}/seguir`);
    await expect(paradaNaTela(page, padaria)).toContainText('A caminho');
    await comandoMotorista(request, token, `paradas/${p1!.id}/cheguei`);
    await expect(paradaNaTela(page, padaria)).toContainText('No local');
    await comandoMotorista(request, token, `paradas/${p1!.id}/ocorrencias`, {
      tipo: 'OUTRO',
      descricao: 'Portão fechado na chegada',
    });
    await expect(paradaNaTela(page, padaria)).toContainText('“Portão fechado na chegada”');
    await comandoMotorista(request, token, `servicos/${coleta.id}/realizar`);
    await comandoMotorista(request, token, `servicos/${entrega.id}/nao-realizar`, { tipoOcorrencia: 'CLIENTE_AUSENTE' });
    const primeira = paradaNaTela(page, padaria);
    await expect(primeira).toContainText('Finalizada');
    await expect(primeira).toContainText('Cliente ausente');
    await expect(primeira).toContainText('Entrega não realizada');
  });

  await test.step('segunda parada e conclusão automática da rota', async () => {
    await comandoMotorista(request, token, `paradas/${p2!.id}/seguir`);
    await comandoMotorista(request, token, `paradas/${p2!.id}/cheguei`);
    await comandoMotorista(request, token, `servicos/${p2!.servicos[0]!.id}/realizar`);
    await expect(titulo).toContainText('Concluída');
    await expect(page.getByText('2/2 paradas concluídas')).toBeVisible();
  });

  await test.step('histórico conta o que aconteceu, com o motivo e a empresa', async () => {
    const historico = page.getByRole('region', { name: 'Histórico' });
    await expect(historico).toContainText('Rota concluída');
    await expect(historico).toContainText(`Outro · ${padaria}`);
    await expect(historico).toContainText(`Cliente ausente · ${padaria}`);
  });
});

---
name: testing-quality
description: Estratégia e execução de testes e verificações de qualidade do sistema de rotas e entregas — testes unitários das regras de domínio, integração da API com PostgreSQL real, matriz de acesso entre motoristas, transições de status, falhas de rede e de provedores, validação de migrations, testes do painel e do app, lint e verificação de tipos. Use ao escrever ou revisar testes, ao terminar qualquer funcionalidade e antes de declarar uma tarefa concluída.
---

# testing-quality

## Regras que valem sempre (leia primeiro)

1. **Não declare nada concluído sem rodar** lint, typecheck e os testes do app afetado — e relate os comandos e o resultado real (passou, falhou, não foi possível rodar e por quê).
2. Se um teste falhar, não o apague, não o marque como `skip` e não afrouxe a asserção para passar. Corrija o código ou, se o teste estiver errado, explique por quê.
3. Testes de integração usam PostgreSQL real (Docker local ou CI), nunca SQLite nem mocks do Prisma.
4. Todo endpoint de motorista tem teste de acesso a recurso de outro motorista (espera `404`).
5. Toda transição de status tem teste de tabela cobrindo casos permitidos e proibidos.
6. O setup de teste se recusa a rodar se `DATABASE_URL` não apontar para `localhost`/`127.0.0.1` ou para o banco de CI.

## Objetivo e escopo

Responsável por: pirâmide de testes do projeto, ferramentas por app, organização dos arquivos de teste, fábricas de dados, banco de teste, testes obrigatórios por tipo de mudança, comandos de verificação e formato do relatório de verificação.

Fora do escopo: o que as regras devem ser (cada skill dona define); configuração do pipeline de CI (`devops-documentation` usa os comandos daqui).

## Quando usar

- Ao concluir qualquer implementação (sempre).
- Ao criar endpoint, transição, migration, tela crítica ou lógica offline.
- Ao corrigir bug: primeiro um teste que reproduz, depois a correção.

## Ferramentas

| App | Unidade/integração | E2E |
|---|---|---|
| `apps/api` | Jest (padrão do Nest) + Supertest para HTTP | Supertest contra app Nest completo + Postgres |
| `packages/shared` | Jest ou o runner já configurado no workspace | — |
| `apps/admin` | Vitest + Testing Library (ou Jest, se já configurado — não misture os dois no mesmo app) | Playwright para fluxos críticos |
| `apps/driver` | `jest-expo` + `@testing-library/react-native` | manual em emulador no MVP; automatizar (ex.: Maestro) só com ADR |

Use o que já estiver configurado no repositório. Não adicione runner novo se o existente resolve.

## Organização

- Unitários ao lado do código: `transicoes.spec.ts`.
- Integração/E2E da API em `apps/api/test/` (`rotas.e2e-spec.ts`).
- Fábricas em `apps/api/test/fabricas/` (`criarMotorista(tx, sobrescritas)`), com dados fictícios.
- Cada teste de integração cria seus próprios dados; nada depende de ordem de execução. Limpeza por `TRUNCATE ... CASCADE` entre arquivos ou banco por worker.

## Testes obrigatórios por tipo de mudança

| Mudança | Testes mínimos |
|---|---|
| Regra de domínio / transição | tabela (status × comando) com resultado esperado; invariantes (uma parada ativa, conclusão automática) |
| Endpoint admin | sucesso; validação (400 com `detalhes`); sem token 401; token de motorista 403 |
| Endpoint motorista | dono 2xx; outro motorista **404**; admin 403; sem token 401; usuário desativado 401; repetição com mesma `Idempotency-Key` devolve a mesma resposta sem novo evento |
| Edição concorrente | `versao` antiga → 409 `CONFLITO_VERSAO` |
| Migration | aplica em banco vazio; `migrate diff` sem diferença; teste de integração da área afetada passa |
| Consulta de listagem/relatório | resultado correto com dados de exemplo; número de consultas não cresce com o número de itens (N+1) |
| Integração externa (mapas) | timeout, 5xx, resposta vazia → comportamento degradado esperado |
| Painel | componente com estados carregando/vazio/erro/dados; E2E se tocar em "criar e enviar rota" ou login |
| App | fila de comandos: enfileira offline, reenvia em ordem, mantém chave, descarta em 409; tela da parada mostra ações certas por status |

### Exemplo — teste de tabela de transições

```ts
const casos: [StatusParada, ComandoParada, boolean][] = [
  ['PENDENTE', 'SEGUIR_PARA', true],
  ['PENDENTE', 'CHEGAR', false],
  ['A_CAMINHO', 'CHEGAR', true],
  ['NO_LOCAL', 'SEGUIR_PARA', false],
  ['FINALIZADA', 'CHEGAR', false],
  // ... todos os pares
];
it.each(casos)('%s + %s => permitido=%s', (status, comando, esperado) => {
  expect(podeTransicionarParada({ status }, comando).ok).toBe(esperado);
});
```

Gere a lista completa a partir dos enums para garantir que nenhum par fica de fora.

### Exemplo — isolamento entre motoristas

```ts
it('motorista B não acessa rota do motorista A', async () => {
  const rota = await fabricas.rotaEnviada({ motorista: motoristaA });
  await request(app).get(`/api/v1/motorista/rotas/${rota.id}`)
    .set('Authorization', `Bearer ${tokenB}`)
    .expect(404);
});
```

### Teste de cobertura de autorização

Um teste percorre as rotas registradas no Nest e falha se alguma não tiver metadado `@Perfis` nem `@Publico`.

### Teste de espelho dos enums

Compara os valores dos enums do Prisma com os de `packages/shared`; falha se divergirem.

## Comandos de verificação

Ajuste aos scripts reais do `package.json`; os nomes abaixo são o padrão esperado:

```bash
pnpm -r lint
pnpm -r typecheck
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api exec prisma validate
pnpm --filter admin test
pnpm --filter driver test
```

Para mudança limitada a um app, rode lint/typecheck/test desse app **e** de `packages/shared` se ele mudou (os outros apps dependem dele: rode o typecheck deles também).

## Relatório de verificação (formato do resumo final)

```
Verificações executadas:
- pnpm --filter api lint ............ ok
- pnpm --filter api typecheck ....... ok
- pnpm --filter api test ............ 48 passaram, 0 falharam
- pnpm --filter api test:e2e ........ 1 falhou (rotas.e2e-spec.ts: transferir) — corrigido, 0 falharam na 2ª execução
Não executado:
- E2E do painel (Playwright não instalado neste ambiente)
```

Nunca escreva "todos os testes passam" sem ter a saída correspondente nesta conversa.

## Erros a evitar

- Mockar o Prisma para testar regra de permissão (o bug costuma estar no `where`).
- Testar só o caminho feliz de transições.
- Teste que depende de horário real; use relógio controlado (`jest.useFakeTimers` ou injeção de `agora()`).
- Snapshots grandes de componentes como único teste de UI.
- Rodar teste destrutivo contra banco remoto compartilhado.
- Contar cobertura percentual como critério de qualidade; o critério é a tabela de testes obrigatórios.

## Critérios de conclusão

- [ ] Testes obrigatórios da tabela para o tipo de mudança existem.
- [ ] Lint, typecheck e testes dos apps afetados executados nesta sessão, com resultado relatado.
- [ ] Nenhum teste desativado ou enfraquecido para passar.
- [ ] O que não pôde ser executado está listado com o motivo.

## Integração com outras skills

- Cada skill de implementação aponta para cá em seus critérios de conclusão.
- `delivery-domain-rules` fornece a tabela de transições usada nos testes.
- `auth-security-lgpd` fornece a matriz de acesso.
- `devops-documentation` executa os mesmos comandos no CI com um serviço Postgres.

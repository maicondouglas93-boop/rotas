---
name: devops-documentation
description: Ambiente, implantação e documentação do sistema de rotas e entregas — execução local com pnpm e Docker, variáveis de ambiente, README e guias, documentação OpenAPI da API, CI no GitHub Actions, deploy na Render (API), Vercel (painel), Neon (PostgreSQL) e EAS (app Android), logs estruturados, health checks, backups e restauração, e proteção de segredos. Use ao configurar ambiente, scripts, CI, deploy, logs, monitoramento, backups ou ao escrever documentação de instalação e operação.
---

# devops-documentation

## Regras que valem sempre (leia primeiro)

1. Segredo nunca entra no repositório, em log, em mensagem de erro, em `NEXT_PUBLIC_*` ou em `EXPO_PUBLIC_*` (essas variáveis vão embutidas no bundle público).
2. Toda variável de ambiente nova entra, no mesmo PR, em: schema de validação do app, `.env.example` (valor fictício) e tabela de `docs/ambiente.md`.
3. A API valida as variáveis na inicialização (Zod) e **não sobe** se faltar alguma obrigatória.
4. Produção só recebe `prisma migrate deploy`. Nenhum comando de reset, push ou seed em produção.
5. Documentação é atualizada no mesmo PR da mudança que a torna desatualizada (comando, variável, endpoint, procedimento).
6. Ambientes separados — local, homologação e produção — com bancos e segredos próprios.

## Objetivo e escopo

Responsável por: scripts do workspace, `docker-compose.yml`, `.env.example`, validação de ambiente, README e `docs/` (exceto ADRs, que são de `architecture-guardian`), OpenAPI, pipelines de CI, configuração de deploy, logger, health checks, rotinas de backup/restauração e runbooks.

Fora do escopo: o que é dado sensível e o que deve ser mascarado (`auth-security-lgpd` define a lista; aqui ela é aplicada); quais testes rodar (`testing-quality` define; aqui eles rodam no CI).

## Quando usar

- Preparar o ambiente local ou um app novo no workspace.
- Adicionar variável de ambiente, script ou serviço local.
- Configurar ou alterar CI, deploy, domínio, logs ou health check.
- Escrever/atualizar README, guias de instalação, deploy ou operação.
- Planejar ou testar backup e restauração.

## Execução local

Pré-requisitos fixados no repositório: versão do Node em `.nvmrc` e `engines`; pnpm via `packageManager` no `package.json` raiz (Corepack).

```yaml
# docker-compose.yml — só infraestrutura local
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: rotas
      POSTGRES_PASSWORD: rotas_dev
      POSTGRES_DB: rotas
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/postgres/init:/docker-entrypoint-initdb.d:ro   # cria rotas_test
volumes:
  pgdata:
```

Sequência documentada no README (mantenha os dois em sincronia):

```bash
pnpm install            # postinstall compila packages/shared e gera o Prisma Client
pnpm db:up
cp apps/api/.env.example apps/api/.env   # e os demais .env*.example
pnpm --filter api db:migrate
pnpm dev                # API + painel; o app roda com pnpm dev:driver
```

O banco de teste `rotas_test` é criado pelo script em `infra/postgres/init` na primeira subida do volume; se o volume já existia, crie-o manualmente ou recrie o volume.

## Variáveis de ambiente (referência inicial)

| Variável | App | Secreta | Exemplo |
|---|---|---|---|
| `DATABASE_URL` | api | sim | `postgresql://rotas:rotas_dev@localhost:5432/rotas` (Neon: URL com pooling) |
| `DIRECT_DATABASE_URL` | api | sim | URL sem pooling, usada por migrations |
| `JWT_SECRET` | api | sim | 32+ bytes aleatórios |
| `CORS_ORIGENS` | api | não | `http://localhost:3000` |
| `COOKIE_DOMINIO` | api | não | `.exemplo.com.br` |
| `MAPS_SERVER_API_KEY` | api | sim | chave do provedor restrita por API |
| `LOG_LEVEL` | api | não | `info` |
| `NEXT_PUBLIC_API_URL` | admin | não | `http://localhost:4000/api/v1` |
| `NEXT_PUBLIC_MAPS_API_KEY` | admin | pública restrita | chave restrita por domínio |
| `EXPO_PUBLIC_API_URL` | driver | não | `http://10.0.2.2:4000/api/v1` (emulador Android) |

## Documentação mantida

| Arquivo | Conteúdo |
|---|---|
| `README.md` | o que é o sistema, estrutura do monorepo, pré-requisitos, execução local, comandos, links para `docs/` |
| `docs/ambiente.md` | tabela completa de variáveis por app e ambiente |
| `docs/deploy.md` | passo a passo de deploy de cada app, ordem (banco → API → painel → app), rollback |
| `docs/operacao.md` | backups, restauração, rotação de segredos, revogar todas as sessões, o que olhar em incidentes |
| `docs/api/` | OpenAPI (gerado ou mantido conforme ADR) e convenções (envelope de erro, paginação, idempotência) |
| `docs/limitacoes.md` | limitações conhecidas e decisões temporárias do MVP, com data |

OpenAPI: servido em `/api/docs` só em local e homologação. A ferramenta de geração a partir dos schemas Zod é decidida em ADR, verificando compatibilidade com a versão do Zod instalada; até lá, documente os endpoints em `docs/api/` à mão.

## Logs e erros

- Hoje: `ConsoleLogger` nativo do Nest com `json: true` em produção e nível por `LOG_LEVEL`; o filtro de exceções loga só método, rota, `requestId` e stack de erros 500 — nunca corpo, query ou cabeçalhos.
- Quando for preciso log de cada requisição (`usuarioId`, `rota`, `status`, `duracaoMs`), adote `nestjs-pino` com `redact` configurado com a lista de `auth-security-lgpd` (justifique a dependência no PR).
- `requestId`: lê `x-request-id` ou gera UUID; devolve no cabeçalho e no envelope de erro.
- Erro 500: log com stack e `requestId`; cliente recebe só a mensagem genérica.
- `app.enableShutdownHooks()` para encerrar conexões do Prisma e do Socket.IO no redeploy.

## Health checks

- `GET /api/v1/saude` — processo vivo; não toca no banco; usado pelo health check da Render.
- `GET /api/v1/saude/pronto` — executa `SELECT 1` com timeout de 2 s; usado por monitoramento.
- Respostas públicas sem detalhes internos: `{ "status": "ok", "versao": "<sha do commit>" }`.

## CI (GitHub Actions)

Em todo PR e push na branch principal:

1. `pnpm install --frozen-lockfile` (cache do pnpm).
2. `pnpm -r lint` e `pnpm -r typecheck`.
3. Serviço `postgres:16` no job; `prisma migrate deploy` no banco do CI; `prisma migrate diff` para checar que schema e migrations estão em sincronia.
4. Testes conforme `testing-quality`.
5. Build de `api` e `admin`.

Segredos do CI em GitHub Secrets; habilite secret scanning/push protection no repositório.

## Deploy

**API — Render (Web Service):**
- Build: `pnpm install --frozen-lockfile && pnpm --filter api build`.
- Migrations: comando de pre-deploy `pnpm --filter api exec prisma migrate deploy`; se o plano não oferecer pre-deploy, rodar como etapa do CI antes de liberar o deploy.
- Start: `node apps/api/dist/main.js`; health check em `/api/v1/saude`.
- Socket.IO roda aqui (a Vercel não mantém conexões WebSocket de longa duração). Instâncias gratuitas hibernam: primeira requisição lenta e sockets desconectados — use instância paga em produção.

**Painel — Vercel:** Root Directory `apps/admin`; variáveis separadas para Preview (API de homologação) e Production.

**Banco — Neon:** branch principal para produção, branch separada para homologação; aplicação usa URL com pooling, migrations usam URL direta.

**App — EAS Build:** `eas.json` com perfis `development` (dev client), `preview` (APK para distribuição interna) e `production` (AAB para a Play Store), cada um com seu `EXPO_PUBLIC_API_URL`. Atualização OTA (EAS Update) só com ADR, por causa de compatibilidade de versão nativa.

## Backups e restauração

- Neon: restauração para ponto no tempo dentro da janela de histórico do plano contratado — confirme a janela e registre em `docs/operacao.md`.
- Cópia lógica diária adicional (`pg_dump -Fc`) por job agendado, gravada em storage privado com criptografia e retenção de 30 dias.
- Teste de restauração mensal em uma branch/base descartável, com contagem de linhas das tabelas principais; registre data e resultado em `docs/operacao.md`.
- Documente objetivo de perda máxima (RPO) e tempo de recuperação (RTO) acordados.

## Erros a evitar

- `console.log` de objetos de requisição ou de erro do Prisma completos.
- Chave de servidor de mapas ou `JWT_SECRET` em variável `NEXT_PUBLIC_`/`EXPO_PUBLIC_`.
- Rodar `prisma migrate dev` apontando para Neon de produção.
- Health check que consulta o banco sendo usado para reiniciar a instância (instabilidade do banco derruba a API em cascata).
- README com comandos que não existem nos `package.json`.
- Dockerfile e orquestração para produção sem necessidade; Docker aqui é para Postgres local e CI.

## Critérios de conclusão

- [ ] Variável nova presente no schema de validação, `.env.example` e `docs/ambiente.md`.
- [ ] Comandos do README executados do zero em ambiente limpo (ou informado que não foi possível).
- [ ] CI verde no PR (ou falha explicada).
- [ ] Logs revisados: nenhum campo da lista de redação aparece.
- [ ] Health checks respondem localmente.
- [ ] `docs/deploy.md` e `docs/operacao.md` refletem a mudança.

## Exemplos

**Adicionar chave do provedor de mapas:** `MAPS_SERVER_API_KEY` no `env.ts` da API (obrigatória fora de `test`), `.env.example` com `troque-por-sua-chave`, linha em `docs/ambiente.md`, configuração na Render (produção e homologação com chaves diferentes) e limite de orçamento no console do provedor anotado em `docs/operacao.md`.

**Incidente "motoristas não recebem rotas":** runbook em `docs/operacao.md` → checar `/saude/pronto`, logs filtrados por `rota=/api/v1/rotas/:id/enviar` e `nivel=error`, status do Socket.IO no painel, e se o app recebe a rota via REST (o socket é só aviso).

## Integração com outras skills

- `architecture-guardian` mantém os ADRs; esta skill mantém o resto de `docs/`.
- `auth-security-lgpd` define segredos e redação; aplicados aqui.
- `testing-quality` define os comandos que o CI executa.
- `postgres-prisma-data` define migrations e seeds executados aqui.
- `react-native-driver-app` usa os perfis EAS definidos aqui.

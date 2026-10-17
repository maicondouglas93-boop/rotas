# Rotas — Sistema de Gestão de Rotas e Entregas

Plataforma para cadastrar empresas e motoristas, montar rotas de coleta e entrega, enviá-las ao aplicativo do motorista e acompanhar a execução.

| Parte | Pasta | Tecnologia | Hospedagem prevista |
|---|---|---|---|
| API (regras de negócio, autenticação, dados) | `apps/api` | NestJS 12, Prisma 7, PostgreSQL, Zod | Render |
| Painel administrativo | `apps/admin` | Next.js 16, Tailwind 4, shadcn/ui, TanStack Query | Vercel |
| Aplicativo do motorista (Android) | `apps/driver` | Expo SDK 58, Expo Router, TanStack Query | EAS Build |
| Contratos compartilhados | `packages/shared` | TypeScript + Zod (enums, schemas, links, erros) | — |

Banco em produção: Neon (PostgreSQL). Painel e app falam só com a API; nenhum dos dois acessa o banco.

## Estado atual

Pronto na API: login e sessão (JWT + refresh rotativo, perfis ADMIN e MOTORISTA), cadastro de empresas, cadastro de motoristas (senha temporária, desativação com corte imediato de acesso) e as regras de transição de status. Ainda faltam montagem e execução de rotas, e as telas do painel e do app (hoje só verificam a conexão com a API).

## Pré-requisitos

- Node.js 22.18 ou superior (`.nvmrc`)
- pnpm 11 (`corepack enable` usa a versão de `packageManager`)
- Docker (PostgreSQL local)
- Para o app: Android Studio com emulador, ou um aparelho Android com Expo Go / build de desenvolvimento

## Primeira execução

```bash
pnpm install
```

```bash
pnpm db:up
```

```bash
cp apps/api/.env.example apps/api/.env
cp apps/api/.env.test.example apps/api/.env.test
cp apps/admin/.env.example apps/admin/.env.local
cp apps/driver/.env.example apps/driver/.env.local
```

```bash
pnpm --filter api db:migrate
```

Crie o primeiro administrador (usa `SEED_ADMIN_EMAIL` e `SEED_ADMIN_SENHA` do `apps/api/.env`; troque a senha de exemplo e gere um `JWT_SECRET` aleatório antes):

```bash
pnpm --filter api db:seed
```

```bash
pnpm dev
```

- API: http://localhost:4000/api/v1/saude
- Painel: http://localhost:3000

App do motorista (em outro terminal, com o emulador aberto):

```bash
pnpm dev:driver
```

No emulador Android a API é acessada por `10.0.2.2`; em aparelho físico, troque `EXPO_PUBLIC_API_URL` em `apps/driver/.env.local` pelo IP do computador na rede.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | API + painel + recompilação do `packages/shared` |
| `pnpm dev:driver` | Metro/Expo do app do motorista |
| `pnpm lint` | lint de todos os pacotes (oxlint na API, ESLint no painel e no app) |
| `pnpm typecheck` | verificação de tipos de todos os pacotes |
| `pnpm test` | testes unitários de todos os pacotes |
| `pnpm test:e2e` | testes de integração da API contra o banco `rotas_test` |
| `pnpm build` | build de produção (shared, API, painel) |
| `pnpm db:up` / `pnpm db:down` | sobe/derruba o PostgreSQL local |
| `pnpm --filter api db:migrate` | cria/aplica migrations em desenvolvimento |
| `pnpm --filter api db:deploy` | aplica migrations pendentes (homologação/produção) |

Para adicionar pacote ao app do motorista use `pnpm exec expo install <pacote>` dentro de `apps/driver` (escolhe a versão compatível com o SDK).

## Documentação

- [docs/ambiente.md](docs/ambiente.md) — variáveis de ambiente de cada app
- [docs/skills-guide.md](docs/skills-guide.md) — skills do Claude Code do projeto e como usá-las
- `docs/adr/` — decisões de arquitetura (criadas conforme forem tomadas)
- `.claude/skills/` — regras de arquitetura, domínio, segurança, testes e implantação

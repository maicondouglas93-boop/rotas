# Variáveis de ambiente

Toda variável nova entra, no mesmo PR, no schema de validação do app, no `.env.example` e nesta tabela.
Arquivos `.env*` reais nunca são commitados (só os `*.example`).

## API (`apps/api`)

Validadas na inicialização por `src/config/env.ts`: a API não sobe se faltar alguma obrigatória. A mensagem de erro cita só o nome da variável.

| Variável | Obrigatória | Secreta | Padrão / exemplo | Uso |
|---|---|---|---|---|
| `NODE_ENV` | não | não | `development` | `development`, `test` ou `production` (em produção os logs saem em JSON) |
| `PORT` | não | não | `4000` | porta HTTP |
| `DATABASE_URL` | sim | sim | `postgresql://rotas:rotas_dev@localhost:5432/rotas` | conexão da aplicação (no Neon, a URL **com pooling**) |
| `DIRECT_DATABASE_URL` | não | sim | igual à `DATABASE_URL` no local | conexão direta usada pela CLI do Prisma (migrations); lida em `prisma.config.ts` |
| `CORS_ORIGENS` | não | não | `http://localhost:3000` | origens do painel, separadas por vírgula |
| `LOG_LEVEL` | não | não | `log` | `fatal`, `error`, `warn`, `log`, `debug`, `verbose` |
| `RENDER_GIT_COMMIT` | não | não | definida pela Render | versão exibida em `/saude` |

`apps/api/.env.test` (testes e2e) usa o banco `rotas_test`; o setup dos testes recusa qualquer host que não seja local.

## Painel (`apps/admin`)

Variáveis `NEXT_PUBLIC_*` são embutidas no JavaScript enviado ao navegador: nunca coloque segredos nelas.

| Variável | Obrigatória | Exemplo | Uso |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | sim em produção | `http://localhost:4000/api/v1` | endereço da API |

## App do motorista (`apps/driver`)

Variáveis `EXPO_PUBLIC_*` são embutidas no aplicativo: nunca coloque segredos nelas.

| Variável | Obrigatória | Exemplo | Uso |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | sim em build | `http://10.0.2.2:4000/api/v1` | endereço da API (`10.0.2.2` = computador visto pelo emulador Android) |

## Banco local (Docker)

`docker-compose.yml` sobe PostgreSQL 16 com usuário `rotas` / senha `rotas_dev` (somente desenvolvimento) e cria os bancos `rotas` e `rotas_test` (`infra/postgres/init`).

# Variáveis de ambiente

Toda variável nova entra, no mesmo PR, no schema de validação do app, no `.env.example` e nesta tabela.
Arquivos `.env*` reais nunca são commitados (só os `*.example`).

## API (`apps/api`)

Validadas na inicialização por `src/config/env.ts`: a API não sobe se faltar alguma obrigatória. A mensagem de erro cita só o nome da variável.

| Variável | Obrigatória | Secreta | Padrão / exemplo | Uso |
|---|---|---|---|---|
| `NODE_ENV` | não | não | `development` | `development`, `test` ou `production` (em produção os logs saem em JSON e o cookie de refresh usa `Secure`) |
| `PORT` | não | não | `4000` | porta HTTP |
| `DATABASE_URL` | sim | sim | `postgresql://rotas:rotas_dev@localhost:5432/rotas` | conexão da aplicação (no Neon, a URL **com pooling**) |
| `DIRECT_DATABASE_URL` | não | sim | igual à `DATABASE_URL` no local | conexão direta usada pela CLI do Prisma (migrations); lida em `prisma.config.ts` |
| `CORS_ORIGENS` | não | não | `http://localhost:3000` | origens do painel, separadas por vírgula (também verificadas no `Origin` de `/auth/refresh` com cookie) |
| `LOG_LEVEL` | não | não | `log` | `fatal`, `error`, `warn`, `log`, `debug`, `verbose` |
| `JWT_SECRET` | sim | sim | 32+ caracteres aleatórios | chave de assinatura HS256 do access token JWT |
| `JWT_ACCESS_MINUTOS` | não | não | `15` | validade do access token em minutos |
| `REFRESH_DIAS` | não | não | `30` | validade do refresh token e do cookie `rotas_refresh` em dias |
| `COOKIE_DOMINIO` | não | não | `.exemplo.com.br` | domínio opcional do cookie `rotas_refresh` quando painel e API estão em subdomínios |
| `LIMITE_LOGIN_POR_MINUTO` | não | não | `5` (`1000` em `.env.test`) | limite de tentativas por IP + e-mail por minuto em `POST /api/v1/auth/login` (além do teto de 60/min por IP) |
| `SEED_ADMIN_EMAIL` | no seed | não | `admin@rotas.local` | e-mail do administrador inicial criado por `prisma/seed.ts` |
| `SEED_ADMIN_SENHA` | no seed | sim | senha de 8–128 caracteres | senha do administrador inicial criado por `prisma/seed.ts` (recusa `NODE_ENV=production`) |
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

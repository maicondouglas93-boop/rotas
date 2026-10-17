---
name: auth-security-lgpd
description: Autenticação, autorização e proteção de dados do sistema de rotas e entregas — login, JWT com refresh token rotativo, perfis ADMIN e MOTORISTA, isolamento de rotas por motorista, segurança da API e do Socket.IO, segredos, e aplicação da LGPD a dados de motoristas, recebedores, fotos, assinaturas e localização. Use ao mexer em login, sessão, guards, permissões, upload de arquivos, coleta de localização, logs com dados pessoais ou variáveis secretas.
---

# auth-security-lgpd

## Regras que valem sempre (leia primeiro)

1. **Negar por padrão.** O guard JWT é global; só rotas marcadas com `@Publico()` (login, refresh, health) dispensam token. Todo controller declara `@Perfis(...)`.
2. **Motorista só enxerga o que é dele.** Toda consulta de motorista filtra por `motoristaId` do token **no `where` da consulta**, nunca depois. Recurso de outro motorista retorna `404 NAO_ENCONTRADO`, não 403.
3. Nunca confie em `motoristaId`, `perfil`, `usuarioId` ou `status` vindos do corpo, query ou payload de socket.
4. Senhas com Argon2id. Refresh token é valor aleatório opaco, guardado só como hash SHA-256.
5. Segredos nunca no repositório, nunca em `NEXT_PUBLIC_*` ou `EXPO_PUBLIC_*`, nunca em log.
6. Localização do motorista só é coletada durante rota `EM_ANDAMENTO` e com permissão concedida. Fotos e assinaturas ficam em storage privado, acessadas por URL assinada de curta duração.
7. Esta skill orienta decisões técnicas de privacidade; bases legais, prazos de retenção e textos de aviso devem ser confirmados pelo controlador/encarregado (DPO) do cliente. Não apresente isto como parecer jurídico.

## Objetivo e escopo

Responsável por: fluxo de autenticação, sessões, guards e decorators de autorização, regras de propriedade de recurso, cabeçalhos e limites de segurança da API, autenticação do Socket.IO, armazenamento de credenciais no app e no painel, política de dados pessoais (inventário, minimização, retenção, acesso) e lista de dados que não podem aparecer em log.

Fora do escopo:
- A quem uma rota pertence e quando ela muda de dono → `delivery-domain-rules` (esta skill aplica essa informação no controle de acesso).
- Configuração do logger e da infraestrutura → `devops-documentation` (aplica a lista de redação definida aqui).

## Quando usar

- Implementar ou alterar login, logout, refresh, troca ou redefinição de senha.
- Criar qualquer endpoint novo (verificar perfil e filtro de propriedade).
- Implementar upload de foto/assinatura, rastreamento de localização ou exportação de dados.
- Adicionar variável de ambiente sensível ou chave de API de terceiros.
- Revisar código que loga requisições, erros ou payloads.

## Autenticação

### Fluxo

| Etapa | Detalhe |
|---|---|
| Login | `POST /api/v1/auth/login` `{ email, senha }`. Erro sempre genérico: "E-mail ou senha inválidos." |
| Access token | JWT, 15 min, claims `sub` (usuarioId), `perfil`, `mid` (motoristaId, se houver), `sid` (sessão). Sem dados pessoais. Algoritmo fixado na verificação. |
| Refresh token | 32 bytes aleatórios (base64url), validade 30 dias, gravado em `SessaoRefresh.tokenHash` (SHA-256). |
| Rotação | Cada `POST /auth/refresh` revoga o token usado e emite outro na mesma `familiaId`. |
| Reuso | Token já revogado apresentado de novo → revogar toda a família e exigir login. |
| Logout | Revoga a sessão atual. "Sair de todos os dispositivos" revoga todas do usuário. |
| Desativação | Desativar motorista revoga todas as sessões; o guard confere `usuario.ativo` a cada requisição. |
| Primeiro acesso | Conta criada pelo admin com senha temporária e `deveTrocarSenha = true`; a API só aceita `/auth/trocar-senha` até a troca. |

### Onde os tokens ficam

- **Painel (Next.js):** access token só em memória. Refresh token em cookie `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth`. Em produção, painel e API em subdomínios do mesmo domínio (ex.: `painel.exemplo.com.br` e `api.exemplo.com.br`) para o cookie ser same-site. Se forem domínios diferentes (`*.vercel.app` e `*.onrender.com`), o cookie é cross-site: exige `SameSite=None; Secure` **e** proteção CSRF (token double-submit) no refresh — registre a escolha em ADR.
- **App (Expo):** refresh token em `expo-secure-store`; access token em memória. Nunca `AsyncStorage` para tokens.

### Senhas

- Argon2id (pacote `argon2`). Se a compilação nativa falhar no ambiente de deploy, `bcrypt` com custo ≥ 12, registrado em ADR.
- Mínimo 8 caracteres, máximo 128; sem regras de composição; rejeitar as senhas mais comuns e a senha igual ao e-mail.
- Limite de tentativas: `@nestjs/throttler` no login (ex.: 5/min por IP) + bloqueio temporário progressivo por conta após falhas seguidas.

## Autorização

### Decorators e guards

- `@Publico()` — dispensa JWT.
- `@Perfis('ADMIN')` / `@Perfis('MOTORISTA')` — checado por `PerfisGuard` global. Controller sem `@Perfis` e sem `@Publico` deve falhar em teste (ver `testing-quality`).
- `@UsuarioAtual()` — injeta `{ usuarioId, perfil, motoristaId, sessaoId }`.

### Propriedade de recurso (motorista)

```ts
// Rota
prisma.rota.findFirst({ where: { id, motoristaId: usuario.motoristaId, status: { not: 'RASCUNHO' } } });
// Parada
prisma.parada.findFirst({ where: { id, rota: { motoristaId: usuario.motoristaId } } });
// Serviço
prisma.servico.findFirst({ where: { id, parada: { rota: { motoristaId: usuario.motoristaId } } } });
```

Motorista não vê rota em `RASCUNHO` nem rota transferida para outro motorista. Ao transferir, o motorista anterior perde acesso imediatamente (inclusive às paradas que ele mesmo executou; o histórico dele fica visível só ao admin).

### Socket.IO

- Autenticação no handshake: `socket.handshake.auth.token` verificado em middleware `io.use(...)`; token inválido → conexão recusada.
- O servidor coloca o socket nas salas: ADMIN → `admin`; MOTORISTA → `motorista:<mid>`. Entrada em `rota:<id>` só depois de verificar propriedade como no REST.
- Nenhum evento enviado pelo cliente altera estado; comandos vão pelo REST (com idempotência).
- Desconecte quando o access token expirar; o cliente reconecta com token novo.

## Segurança da API

- `helmet()`; CORS com lista explícita de origens por ambiente (nunca `*` com credenciais).
- Schemas Zod `.strict()` em toda entrada (bloqueia atribuição em massa); limites de tamanho de string e de array (ex.: no máximo 100 paradas por rota).
- Limite de corpo JSON (ex.: 1 MB). Uploads não passam pelo corpo JSON.
- Respostas por mapper: nunca `senhaHash`, `tokenHash`, documento completo para quem não precisa.
- Consultas Prisma parametrizadas; `$queryRawUnsafe` com entrada do usuário é proibido.
- Requisições a serviços externos (mapas) usam URL base fixa de configuração; o usuário nunca fornece URL que o servidor busca (SSRF).
- IDs UUID evitam enumeração, mas não substituem o filtro de propriedade.

### Uploads (Etapa 2: comprovantes)

- App pede à API uma URL de upload assinada (`POST /motorista/servicos/:id/comprovante/upload-url`), com tipo (`image/jpeg`, `image/png`) e tamanho máximo (ex.: 5 MB) fixados na assinatura.
- Bucket privado; chave de objeto aleatória (`comprovantes/<rotaId>/<uuid>.jpg`); nome original do arquivo não é usado.
- Reencodar a foto no app antes do envio (remove EXIF, inclusive GPS do arquivo).
- Leitura pelo painel com URL assinada de ~5 minutos, gerada sob demanda para ADMIN.

## LGPD — aplicação no projeto

### Inventário de dados pessoais

| Dado | Titular | Finalidade | Onde fica | Quem acessa | Retenção sugerida* |
|---|---|---|---|---|---|
| Nome, e-mail, telefone | Motorista | conta e contato operacional | `usuarios`, `motoristas` | admin; o próprio | enquanto ativo + prazo legal |
| Nome do responsável, telefone/WhatsApp | Contato da empresa | contato na coleta/entrega | `empresas`, snapshot em `paradas` | admin; motorista da rota | enquanto cliente ativo |
| CPF/CNPJ | Empresa / pessoa física | identificação fiscal (opcional) | `empresas.documento` | admin | enquanto cliente ativo |
| Nome do recebedor, assinatura, foto | Recebedor | comprovante de entrega | `comprovantes` + storage | admin | prazo contratual |
| Posições GPS | Motorista | acompanhamento da rota | `posicoes_motorista` | admin durante a rota | pontos brutos 90 dias; depois só agregados |
| Endereço IP, user agent | Usuários | segurança de sessão | `sessoes_refresh`, logs | sistema | 90 dias |

\* Valores iniciais para configuração; confirmar com o responsável jurídico do cliente.

### Regras de minimização

- Não coletar CPF do motorista nem do recebedor se não houver finalidade definida. Se for exigido, guardar e exibir mascarado (`***.456.789-**`).
- Localização: só durante `EM_ANDAMENTO`, só do motorista da rota, intervalo configurável (ex.: 30–60 s); o app mostra indicador visível enquanto coleta e explica o motivo antes de pedir permissão. Nada de coleta fora do expediente ou após concluir a rota.
- Admin vê a última posição durante a rota; histórico de trajeto só para cálculo de distância percorrida e relatórios.
- Ao desativar motorista: manter histórico operacional, bloquear acesso, e oferecer anonimização dos dados de contato após o prazo de retenção.
- Exportação dos dados de um titular (pedido de acesso): rotina administrativa documentada que gera JSON com os dados ligados ao usuário.

### O que nunca vai para log (lista de redação)

`senha`, `senhaAtual`, `novaSenha`, `token`, `refreshToken`, `accessToken`, cabeçalho `authorization`, cabeçalho `cookie`, `set-cookie`, `documento` (completo), `assinatura`, conteúdo/URL assinada de foto, `latitude`/`longitude` de posição do motorista. `devops-documentation` configura o logger com esta lista.

## Segredos e chaves de terceiros

- `.env` no `.gitignore`; `.env.example` com nomes e valores fictícios.
- `JWT_SECRET` com ≥ 32 bytes aleatórios, diferente por ambiente.
- Chave de mapas usada no app/painel é pública por natureza: restrinja por pacote Android + SHA-1 e por domínio HTTP no console do provedor, e limite às APIs necessárias. Chave usada pelo servidor é outra, restrita por API, e nunca vai para o cliente.
- Se um segredo vazar no git: rotacionar primeiro, limpar histórico depois.

## Erros a evitar

- Buscar a rota por `id` e depois comparar `rota.motoristaId !== usuario.motoristaId` em código (fácil esquecer em um endpoint; o filtro no `where` é a regra).
- Retornar 403 para rota de outro motorista (confirma que o id existe).
- Guardar o refresh token em texto puro ou como JWT de longa duração.
- Permitir que o cliente escolha a sala do Socket.IO.
- Pedir permissão de localização em segundo plano no MVP.
- Logar `req.body` inteiro em erro.

## Critérios de conclusão

- [ ] Endpoint novo tem `@Perfis` ou `@Publico` e teste de acesso (401/403/404) conforme `testing-quality`.
- [ ] Consultas de motorista com filtro de propriedade no `where`.
- [ ] Nenhum segredo novo no código, em variável pública ou em log.
- [ ] Fluxo de refresh testado: rotação, reuso detectado, logout, usuário desativado.
- [ ] Dado pessoal novo incluído no inventário desta skill com finalidade e retenção.
- [ ] Lista de redação atualizada se surgiu campo sensível novo.

## Exemplos

**Motorista tenta abrir rota de outro:** `GET /api/v1/motorista/rotas/<id-de-outro>` → consulta com `motoristaId` do token não encontra → `404 NAO_ENCONTRADO`. Teste cobre exatamente esse caso.

**Admin desativa motorista durante rota em andamento:** sessões revogadas; próximo request do app → 401; app vai para login com a mensagem "Seu acesso foi desativado. Fale com a administração."; a rota continua `EM_ANDAMENTO` aguardando transferência (`delivery-domain-rules`).

**Pedido "mostrar o trajeto do motorista da semana passada no mapa":** permitido só para ADMIN, só dentro do prazo de retenção, e a tela não exporta os pontos brutos.

## Integração com outras skills

- `nestjs-backend` aplica os decorators e o filtro de erros; `delivery-domain-rules` define dono e transferência.
- `react-native-driver-app` e `admin-dashboard-ui` implementam o armazenamento de tokens descrito aqui.
- `postgres-prisma-data` cria `SessaoRefresh`, colunas de retenção e rotinas de limpeza.
- `testing-quality` mantém a matriz de testes de acesso.
- `devops-documentation` aplica a lista de redação nos logs e guarda os segredos nas plataformas.

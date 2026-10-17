---
name: nestjs-backend
description: Implementa a API NestJS do sistema de rotas e entregas (apps/api) — módulos, controllers, services, validação Zod, mapeamento de respostas, tratamento de erros, transações de caso de uso, idempotência de comandos do motorista e gateway Socket.IO. Use ao criar ou alterar endpoints, services, pipes, filtros, guards de rota HTTP ou eventos em tempo real no backend.
---

# nestjs-backend

## Regras que valem sempre (leia primeiro)

1. Controller só faz: validar entrada (pipe Zod), obter o usuário autenticado, chamar **um** método de service, devolver o resultado. Sem Prisma, sem `if` de regra de negócio, sem `try/catch` no controller.
2. Toda entrada externa (body, query, params, payload de socket) passa por schema Zod de `packages/shared` com `.strict()`. Nunca repasse `body` direto para `prisma.*.create({ data: body })`.
3. Nunca devolva o objeto do Prisma. Use um mapper que gera o formato descrito pelo schema de resposta em `packages/shared`.
4. Erros de regra de negócio são `ErroDominio` com `codigo` estável; o filtro global os converte no envelope de erro padrão. Nunca exponha stack trace ou mensagem do Prisma ao cliente.
5. Eventos Socket.IO são emitidos **depois** do commit da transação, com payload mínimo (ids e status). O cliente busca o detalhe via REST.
6. Prefixo global `/api/v1`. Versões antigas do app do motorista continuam instaladas: mudanças em endpoints de `/motorista/*` devem ser aditivas; quebra de contrato exige nova versão.

## Objetivo e escopo

Responsável pela camada de aplicação e HTTP da API: organização do módulo, controllers, services, pipes, filtros de exceção, mapeamento de respostas, paginação, concorrência otimista, idempotência e gateway Socket.IO.

Fora do escopo:
- Quais estados e transições existem → `delivery-domain-rules` (esta skill chama as funções de domínio, não as redefine).
- Schema Prisma, índices, migrations → `postgres-prisma-data`.
- Estratégia de JWT, guards de perfil e regras de propriedade → `auth-security-lgpd` (esta skill aplica os decorators que aquela define).
- Logger, health check, variáveis de ambiente → `devops-documentation`.

## Quando usar

- Criar um módulo ou endpoint novo.
- Alterar um service que grava mais de uma entidade.
- Adicionar um evento em tempo real.
- Corrigir respostas de erro inconsistentes ou controllers inchados.

## Estrutura de um módulo

```
apps/api/src/
├── main.ts                       # bootstrap, prefixo, helmet, CORS, pipes globais
├── app.module.ts
├── comum/
│   ├── erros/erro-dominio.ts     # ErroDominio + códigos
│   ├── filtros/excecoes.filter.ts
│   ├── pipes/zod.pipe.ts
│   ├── paginacao.ts
│   └── idempotencia/             # interceptor + service
├── prisma/prisma.service.ts
└── modulos/rotas/
    ├── rotas.module.ts
    ├── rotas-admin.controller.ts      # /rotas (perfil ADMIN)
    ├── rotas.service.ts               # casos de uso do admin
    ├── rotas.mapper.ts                # Prisma -> schema de resposta
    └── dominio/                       # funções puras (delivery-domain-rules)
        └── transicoes.ts
modulos/execucao/
    ├── motorista-rotas.controller.ts  # /motorista/rotas (perfil MOTORISTA)
    └── execucao.service.ts
```

Controllers de admin e de motorista são **arquivos separados**, com prefixos separados (`/rotas` e `/motorista/...`). Isso deixa explícito qual perfil acessa o quê.

## Procedimento para um endpoint novo

1. Defina ou reutilize o schema de entrada e o de resposta em `packages/shared/src/schemas/<dominio>.ts`. Exporte o tipo com `z.infer`.
2. Escreva o método do service: recebe dados já validados + `UsuarioAutenticado`, faz a operação, retorna o objeto mapeado.
3. Se a operação muda status, chame a função de transição de `dominio/` antes de gravar e grave com atualização condicional (ver "Concorrência").
4. Se grava mais de uma tabela, use `prisma.$transaction(async (tx) => { ... })` e registre o `RotaEvento` dentro da mesma transação.
5. Escreva o controller com o decorator de perfil (`@Perfis('ADMIN')` ou `@Perfis('MOTORISTA')`) e o pipe Zod.
6. Se o endpoint é comando do motorista, aplique o interceptor de idempotência.
7. Emita o evento Socket.IO depois que a transação retornar.
8. Escreva os testes indicados em `testing-quality` e rode `pnpm --filter api lint typecheck test`.

## Padrões de código

### Pipe Zod (sem dependência extra)

```ts
// comum/pipes/zod.pipe.ts
@Injectable()
export class ZodPipe<T extends z.ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(valor: unknown): z.infer<T> {
    const r = this.schema.safeParse(valor);
    if (!r.success) throw ErroDominio.validacao(r.error.issues);
    return r.data;
  }
}
```

### Controller enxuto

```ts
@Controller('rotas')
@Perfis('ADMIN')
export class RotasAdminController {
  constructor(private readonly rotas: RotasService) {}

  @Post(':id/enviar')
  enviar(
    @Param('id', new ZodPipe(idSchema)) id: string,
    @Body(new ZodPipe(enviarRotaSchema)) dados: EnviarRotaEntrada,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.rotas.enviar(id, dados, usuario);
  }
}
```

### Envelope de erro

Toda resposta de erro tem este formato:

```json
{
  "erro": {
    "codigo": "TRANSICAO_INVALIDA",
    "mensagem": "A rota não pode ser iniciada com status RASCUNHO.",
    "detalhes": [],
    "requestId": "b1c2..."
  }
}
```

| Código | HTTP | Quando |
|---|---|---|
| `VALIDACAO` | 400 | Zod falhou; `detalhes` traz `{ caminho, mensagem }` por campo |
| `NAO_AUTENTICADO` | 401 | sem token, token expirado ou usuário desativado |
| `SEM_PERMISSAO` | 403 | perfil errado para o endpoint |
| `NAO_ENCONTRADO` | 404 | recurso inexistente **ou** de outro motorista |
| `TRANSICAO_INVALIDA` | 409 | ação não permitida no status atual |
| `CONFLITO_VERSAO` | 409 | `versao` enviada diferente da atual |
| `REGISTRO_DUPLICADO` | 409 | violação de unicidade (Prisma `P2002`) |
| `REGRA_NEGOCIO` | 422 | invariante de domínio violada (ex.: enviar rota sem paradas) |
| `ERRO_INTERNO` | 500 | qualquer outro; mensagem genérica, detalhe só no log |

O filtro global converte `ErroDominio`, `HttpException` do Nest e erros conhecidos do Prisma (`P2002` → 409, `P2025` → 404). Mensagens em português, voltadas ao usuário final.

### Concorrência

- Edição pelo admin envia `versao`. Grave com `updateMany({ where: { id, versao }, data: { ..., versao: { increment: 1 } } })`; se `count === 0`, lance `CONFLITO_VERSAO`.
- Comandos do motorista usam compare-and-set de status: `updateMany({ where: { id, status: 'A_CAMINHO', ... }, data: { status: 'NO_LOCAL' } })`. `count === 0` → releia e lance `TRANSICAO_INVALIDA` (ou devolva o estado atual se já estiver no destino, para o comando ser idempotente).

### Idempotência dos comandos do motorista

O app envia o header `Idempotency-Key` (UUID v4) em todo `POST` de `/motorista/*`. O interceptor:
1. Procura `(usuarioId, chave)` na tabela de comandos processados.
2. Se existir, devolve a resposta gravada sem executar de novo.
3. Se não existir, executa e grava status + corpo da resposta na mesma transação do comando.
4. Sem header → `400 VALIDACAO`.
O app também envia `ocorridoEm` (horário do dispositivo); o servidor grava `ocorridoEm` e `registradoEm` separadamente e nunca usa `ocorridoEm` para ordenar regras de estado.

### Paginação

Query `?pagina=1&porPagina=20` (`porPagina` máximo 100, validado com `z.coerce.number().int()`). Resposta `{ itens, total, pagina, porPagina }`. Ordenação explícita sempre (`orderBy`), nunca a ordem implícita do banco.

### Datas

Grave e devolva em UTC, formato ISO 8601. Campos só de data (ex.: `dataPrevista` da rota) trafegam como `AAAA-MM-DD`. Conversão para `America/Sao_Paulo` é feita na interface.

### Socket.IO

- Um gateway no módulo `tempo-real`. Outros services chamam `TempoRealService.emitir(sala, evento, payload)`; ninguém injeta o `Server` diretamente.
- Salas: `admin`, `motorista:<motoristaId>`, `rota:<rotaId>`. Quem entra em qual sala é decidido pelo servidor (regras em `auth-security-lgpd`).
- Nomes de eventos vêm de `packages/shared/src/eventos.ts`.
- Payload exemplo: `{ rotaId, paradaId, status, versao }`.

## Erros a evitar

- `try { ... } catch (e) { throw new BadRequestException(e.message) }` — vaza mensagem interna e perde o código.
- Service que chama outro service do mesmo módulo em cadeia para "reaproveitar" e abre transações aninhadas. Passe o `tx` adiante.
- Chamar API externa (geocodificação, push) **dentro** da transação.
- Lógica de autorização espalhada em `if (usuario.perfil === ...)` dentro de services; use os guards e os filtros de propriedade definidos em `auth-security-lgpd`.
- Endpoints genéricos como `PATCH /rotas/:id` aceitando `status` no corpo. Mudança de status é sempre um comando nomeado (`/enviar`, `/cancelar`, `/iniciar`).
- `class-validator` e `class-transformer` em paralelo com Zod. O padrão do projeto é Zod.

## Critérios de conclusão

- [ ] Controller sem acesso a Prisma e sem regra de negócio; cada handler chama um método de service.
- [ ] Entrada validada por schema Zod `.strict()` de `packages/shared`.
- [ ] Resposta passa por mapper; nenhum campo interno (`senhaHash`, `tokenHash`, `versao` quando não pertinente) vaza.
- [ ] Erros seguem o envelope e a tabela de códigos.
- [ ] Mudanças em várias tabelas estão em uma transação, com `RotaEvento` gravado junto.
- [ ] Comandos do motorista exigem `Idempotency-Key` e repetição devolve a mesma resposta.
- [ ] Evento Socket.IO emitido após o commit, com nome vindo de `packages/shared`.
- [ ] `pnpm --filter api lint`, `typecheck` e `test` executados e passando (relate a saída).

## Exemplos

**Comando "Cheguei ao local"** — `POST /api/v1/motorista/paradas/:id/cheguei`:
1. Pipe valida `id` e corpo `{ ocorridoEm }`.
2. `ExecucaoService.registrarChegada(id, dados, usuario)` busca a parada filtrando por `rota.motoristaId = usuario.motoristaId` (404 se não for dele).
3. Chama `podeTransicionarParada(parada, 'CHEGAR')` do domínio.
4. Em transação: compare-and-set `A_CAMINHO → NO_LOCAL`, grava `chegadaEm`, grava `RotaEvento` `PARADA_CHEGADA`, grava resposta idempotente.
5. Após o commit emite `parada.chegada` para `admin` e `rota:<id>`.

**Admin reordena paradas** — `PUT /api/v1/rotas/:id/paradas/ordem` com `{ versao, paradaIds: [...] }`: o service valida que a lista contém exatamente as paradas reordenáveis da rota (regras em `delivery-domain-rules`), atualiza `sequencia` na transação (técnica em `postgres-prisma-data`) e incrementa `versao`.

## Integração com outras skills

- `delivery-domain-rules` fornece as funções puras de transição e invariantes chamadas pelos services.
- `postgres-prisma-data` define como gravar (transações, atualização em lote de sequência, índices).
- `auth-security-lgpd` fornece `@Perfis`, `@Publico`, `@UsuarioAtual` e os filtros de propriedade.
- `testing-quality` define os testes obrigatórios por endpoint.
- `devops-documentation` documenta os endpoints (OpenAPI) e configura logs com `requestId`.

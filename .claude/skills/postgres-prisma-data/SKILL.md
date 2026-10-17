---
name: postgres-prisma-data
description: Projeta e mantém o modelo relacional PostgreSQL do sistema de rotas e entregas com Prisma — schema.prisma, migrations, relacionamentos, chaves estrangeiras, índices, restrições, transações, consultas sem N+1, preservação de histórico e exclusão lógica. Use ao criar ou alterar models, enums, migrations, seeds, consultas de listagem ou relatório e ao investigar lentidão ou inconsistência de dados.
---

# postgres-prisma-data

## Regras que valem sempre (leia primeiro)

1. Migration aplicada nunca é editada. Corrija com uma migration nova.
2. Nunca rode `prisma migrate reset`, `prisma db push` ou SQL destrutivo contra banco que não seja local ou de teste. Antes de qualquer comando de banco, confira o host em `DATABASE_URL`.
3. Empresas, motoristas e rotas que já saíram de `RASCUNHO` **não são apagados**: são arquivados/desativados/cancelados. Exclusão física só de rota em `RASCUNHO`.
4. A parada guarda uma cópia (snapshot) dos dados da empresa usados na execução. O histórico não muda quando o cadastro da empresa muda.
5. Operação que altera mais de uma linha/tabela roda em `prisma.$transaction`. Nada de chamada HTTP externa dentro da transação.
6. Toda listagem tem `take` (máximo 100), `orderBy` explícito e `select`/`include` explícito.

## Objetivo e escopo

Responsável por: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `prisma/seed.ts`, convenções de modelagem, integridade referencial, índices, padrões de consulta e de transação, SQL de relatórios.

Fora do escopo:
- Quais estados existem e quando mudam → `delivery-domain-rules` (esta skill só espelha os enums).
- Retenção e anonimização de dados pessoais → `auth-security-lgpd` define a política; esta skill implementa as colunas e jobs.
- Backup e restauração → `devops-documentation`.

## Quando usar

- Adicionar ou alterar model, campo, enum, relação ou índice.
- Escrever uma consulta de listagem, busca ou relatório.
- Implementar operação que mexe em várias entidades (enviar rota, reordenar paradas, transferir motorista).
- Investigar consulta lenta, deadlock ou dado inconsistente.

## Convenções de modelagem

- `id String @id @default(uuid()) @db.Uuid` em todas as tabelas (não usar inteiro sequencial exposto na API).
- Models no singular em PascalCase; tabelas em snake_case plural via `@@map("rotas")`; campos camelCase com `@map("criado_em")`.
- Datas-hora: `DateTime @db.Timestamptz(3)`. Datas sem hora: `DateTime @db.Date`.
- `criadoEm DateTime @default(now())` e `atualizadoEm DateTime @updatedAt` em tabelas mutáveis.
- Coordenadas: `latitude Float?`, `longitude Float?` (double precision). PostGIS só com ADR, quando houver consulta geográfica no banco.
- Telefones em E.164 (`+5511987654321`); CEP só dígitos `@db.Char(8)`; UF `@db.Char(2)`; CPF/CNPJ só dígitos.
- Enums Prisma com os mesmos valores dos enums de `packages/shared` (definidos em `delivery-domain-rules`). Um teste garante a igualdade.
- Concorrência otimista: `versao Int @default(1)` em `Rota`.

## Modelo de referência (MVP)

Esboço das entidades e relações; os valores de status estão em `delivery-domain-rules`.

| Model | Campos essenciais | Relações e restrições |
|---|---|---|
| `Usuario` | email (único, minúsculo), senhaHash, perfil, ativo, deveTrocarSenha | 1–0..1 `Motorista` |
| `Motorista` | nome, telefone, desativadoEm? | `usuarioId` único; `onDelete: Restrict` |
| `Empresa` | nomeFantasia, razaoSocial?, documento?, telefone, whatsapp?, logradouro, numero, complemento?, bairro, cidade, uf, cep, latitude?, longitude?, fonteLocalizacao?, precisaoLocalizacao?, localizacaoAtualizadaEm?, responsavel?, horarioFuncionamento?, observacoes?, arquivadaEm? | documento único entre não arquivadas (índice parcial em SQL) |
| `Rota` | nome, dataPrevista, status, versao, motoristaId?, ordemOrigem, distanciaEstimadaM?, duracaoEstimadaS?, fonteEstimativa?, estimativaCalculadaEm?, enviadaEm?, recebidaEm?, iniciadaEm?, concluidaEm?, canceladaEm?, motivoCancelamento?, rotaOrigemId? | motorista `Restrict`; `rotaOrigemId` aponta para a rota duplicada |
| `Parada` | rotaId, empresaId, sequencia, status, snapshot (nomeEmpresa, enderecoFormatado, latitude?, longitude?, telefone?, whatsapp?), observacoes?, chegadaEm?, finalizadaEm? | `@@unique([rotaId, sequencia])`; rota `Cascade`; empresa `Restrict` |
| `Servico` | paradaId, tipo, status, executadoPorMotoristaId?, concluidoEm? | `@@unique([paradaId, tipo])`; parada `Cascade` |
| `Ocorrencia` | paradaId, servicoId?, motoristaId, tipo, descricao?, ocorridaEm, registradaEm | parada `Restrict` |
| `RotaEvento` | rotaId, tipo, statusAnterior?, statusNovo?, autorUsuarioId?, dados Json, criadoEm | append-only; sem `updatedAt` |
| `SessaoRefresh` | usuarioId, tokenHash (único), familiaId, expiraEm, revogadaEm?, substituidaPorId? | definida por `auth-security-lgpd` |
| `ComandoProcessado` | usuarioId, chave, statusHttp, corpo Json, criadoEm | `@@id([usuarioId, chave])`; limpeza após 7 dias |
| `Base` (opcional) | nome, endereço, latitude, longitude | ponto de partida das estimativas (`maps-route-planning`) |

Já existe: `Comprovante` (um por serviço: `nomeRecebedor`, `assinatura` em JSON, `fotoChave`/`fotoBytes` no armazenamento, `registradoEm`; migration `comprovantes`). Etapa 2: `PosicaoMotorista` (motoristaId, rotaId, lat, lng, precisaoM, capturadaEm), `RotaModelo` + `RotaModeloParada` para recorrência.

### Índices mínimos

```prisma
model Rota {
  // ...
  @@index([motoristaId, status])
  @@index([dataPrevista])
  @@index([status, dataPrevista])
}
model Parada   { @@index([empresaId]) }
model Servico  { @@index([executadoPorMotoristaId, concluidoEm]) }
model RotaEvento { @@index([rotaId, criadoEm]) }
model Ocorrencia { @@index([paradaId]) @@index([motoristaId, ocorridaEm]) }
```

Crie índice novo só com a consulta que o justifica escrita no PR. Para busca textual de empresas por nome, comece com `ILIKE` + índice B-tree em `lower(nome_fantasia)`; `pg_trgm` só se a busca ficar lenta com dados reais.

### Restrições que o Prisma não expressa

Escreva em SQL dentro da migration (`prisma migrate dev --create-only`, edite, depois aplique):

```sql
CREATE UNIQUE INDEX empresas_documento_ativo_uq
  ON empresas (documento)
  WHERE documento IS NOT NULL AND arquivada_em IS NULL;

ALTER TABLE paradas ADD CONSTRAINT paradas_sequencia_positiva CHECK (sequencia > 0);
ALTER TABLE empresas ADD CONSTRAINT empresas_latitude_valida
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
```

## Padrões de consulta e transação

### Evitar N+1

```ts
// Errado: uma consulta por parada
for (const p of paradas) p.servicos = await prisma.servico.findMany({ where: { paradaId: p.id } });

// Certo: uma consulta com include e select explícito
prisma.rota.findFirst({
  where: { id, motoristaId },
  select: {
    id: true, nome: true, status: true, versao: true,
    paradas: {
      orderBy: { sequencia: 'asc' },
      select: { id: true, sequencia: true, status: true, nomeEmpresa: true,
                enderecoFormatado: true, latitude: true, longitude: true,
                servicos: { select: { id: true, tipo: true, status: true } } },
    },
  },
});
```

Em desenvolvimento, ligue `log: ['query']` no `PrismaClient` para conferir quantas consultas um endpoint dispara.

### Reordenar paradas sem violar `@@unique([rotaId, sequencia])`

Em uma transação, primeiro desloque todas para uma faixa temporária alta (mantém o `CHECK (sequencia > 0)`), depois grave os valores definitivos:

```ts
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`UPDATE paradas SET sequencia = sequencia + 100000 WHERE rota_id = ${rotaId}::uuid`;
  for (const [i, paradaId] of novaOrdem.entries()) {
    await tx.parada.update({ where: { id: paradaId }, data: { sequencia: i + 1 } });
  }
  const r = await tx.rota.updateMany({ where: { id: rotaId, versao }, data: { versao: { increment: 1 } } });
  if (r.count === 0) throw ErroDominio.conflitoVersao();
});
```

Para rotas com muitas paradas, troque o laço por um único `UPDATE ... FROM (VALUES ...)` via `$executeRaw`.

### Atualização condicional (compare-and-set)

Para mudanças de status concorrentes use `updateMany` com o status esperado no `where` e confira `count`. Não leia-e-grave em duas etapas sem condição.

### Relatórios

Agregações em SQL com `prisma.$queryRaw` e template tag (parâmetros seguros). `$queryRawUnsafe` com qualquer valor vindo do usuário é proibido. Defina o tipo do resultado e converta `bigint` de `COUNT` para `number`.

## Migrations

1. Altere `schema.prisma`.
2. `pnpm --filter api exec prisma migrate dev --name verbo_objeto` (ex.: `adiciona_ocorrencias`).
3. Leia o SQL gerado antes de commitar. Procure `DROP`, `ALTER COLUMN ... TYPE`, `NOT NULL` sem default em tabela com dados.
4. Mudança destrutiva em produção é feita em etapas (expandir → migrar dados → trocar código → remover em outro deploy).
5. Em produção apenas `prisma migrate deploy` (executado no pre-deploy, ver `devops-documentation`).
6. Configuração atual (Prisma 7): `apps/api/prisma.config.ts` define o schema, a pasta de migrations e `datasource.url` = `DIRECT_DATABASE_URL` (com fallback para `DATABASE_URL`) — é a conexão usada pela CLI. A aplicação conecta pelo driver adapter `@prisma/adapter-pg` com `DATABASE_URL` (no Neon, a URL com pooling). O `schema.prisma` não tem `url`. Generator `prisma-client` com saída em `src/generated/prisma` (ESM, imports `.js`).
7. Restrições em SQL ficam no fim da migration, na seção "Restrições que o Prisma não expressa". `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` deve sair com 0 (o CI verifica).

## Seeds

`prisma/seed.ts` cria dados fictícios para desenvolvimento: 1 admin, 3 motoristas, ~20 empresas com coordenadas de exemplo, 2 rotas. Nunca use dados reais de pessoas ou clientes. Senhas de seed só em `.env.example`/documentação de desenvolvimento.

## Erros a evitar

- `onDelete: Cascade` de `Empresa` ou `Motorista` para paradas/rotas: apaga histórico.
- Ler o endereço da parada a partir da `Empresa` atual na tela de histórico em vez do snapshot.
- `findMany()` sem `take` em tabelas que crescem (rotas, eventos, ocorrências).
- Índice em toda coluna "por garantia".
- Guardar status derivado e status calculado ao mesmo tempo sem uma regra de quem atualiza (ex.: contadores de paradas na rota). Se precisar de contador, atualize na mesma transação ou calcule na consulta.
- Usar `Json` para dados que serão filtrados ou agregados em relatório.

## Critérios de conclusão

- [ ] `prisma validate` e `prisma format` sem erros.
- [ ] Migration gerada, SQL revisado, aplicada em banco limpo (`migrate deploy`) sem erro.
- [ ] `prisma migrate diff` entre migrations e schema não mostra diferença.
- [ ] Relações com histórico usam `Restrict`; FKs e índices descritos acima presentes.
- [ ] Consultas novas com `select`/`include` explícito, `orderBy` e limite.
- [ ] Operações multi-entidade em transação.
- [ ] Testes de integração contra Postgres real passando (`testing-quality`).

## Exemplos

**"Excluir empresa"** no painel → `POST /empresas/:id/arquivar` grava `arquivadaEm`. Empresas arquivadas não aparecem na busca ao montar rota, mas continuam nas paradas antigas pelo snapshot.

**"Histórico de atendimento por empresa"** → consulta `paradas` por `empresaId` com join em `servicos`, filtrando `rotas.status <> 'RASCUNHO'`, paginada por `finalizadaEm desc`.

**Duplicar rota** → nova `Rota` em `RASCUNHO` com `rotaOrigemId`, paradas copiadas com snapshot atualizado a partir do cadastro atual das empresas, serviços em `PENDENTE`, sem copiar horários de execução.

## Integração com outras skills

- `delivery-domain-rules` define enums, invariantes e quais campos de snapshot são atualizados e quando.
- `nestjs-backend` consome os padrões de transação e consulta.
- `auth-security-lgpd` define a política de retenção que vira colunas, índices e rotinas de limpeza aqui.
- `testing-quality` valida migrations e consultas críticas.

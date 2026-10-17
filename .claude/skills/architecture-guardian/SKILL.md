---
name: architecture-guardian
description: Define e preserva a arquitetura do Sistema de Gestão de Rotas e Entregas (monorepo com API NestJS, painel Next.js, app Expo e pacote compartilhado). Use antes de criar um módulo, app ou pacote novo, mover código entre camadas, adicionar dependência, propor microsserviço, fila ou novo serviço de infraestrutura, ou quando surgir dúvida sobre onde um código deve ficar. Também registra decisões arquiteturais (ADR).
---

# architecture-guardian

## Regras que valem sempre (leia primeiro)

1. Um único backend: `apps/api` (NestJS). O painel e o aplicativo **nunca** acessam o banco diretamente nem usam Prisma; falam só com a API REST e o Socket.IO da API.
2. Monólito modular. Microsserviços, filas externas, serverless functions com regra de negócio e bancos adicionais estão proibidos nesta fase (ver "Quando reconsiderar").
3. Regra de negócio fica na API. Painel e app validam formulários para dar feedback rápido, mas a API revalida tudo.
4. Contratos compartilhados (schemas Zod, enums de status, nomes de eventos, construtores de links) ficam em `packages/shared`. Não copie tipos entre apps.
5. Dependência nova só depois de verificar que o projeto não resolve o problema com o que já tem. Registre o motivo no PR; se for estrutural (ORM, auth, mapas, storage, fila), escreva um ADR.
6. Se o repositório real divergir desta estrutura, siga o repositório e atualize esta skill no mesmo PR. Não reestruture código existente para "encaixar" na skill sem pedido explícito.

## Objetivo e escopo

Responsável por: estrutura de pastas, fronteiras entre apps e módulos, direção das dependências, convenções de nomes globais, critérios para novas dependências e registro de decisões (ADRs).

Fora do escopo (consulte a skill dona):
- Como escrever um módulo NestJS por dentro → `nestjs-backend`.
- Modelo de dados e migrations → `postgres-prisma-data`.
- Estados e transições de rota/parada/serviço → `delivery-domain-rules`.
- Autenticação, autorização, LGPD → `auth-security-lgpd`.
- Docker, CI, deploy, README → `devops-documentation`.

## Quando usar

- Criar o esqueleto do projeto ou um app/pacote novo.
- Criar um módulo NestJS novo ou decidir se algo é módulo próprio ou parte de outro.
- Adicionar qualquer dependência de runtime.
- Alguém sugerir "separar em serviço", "usar Redis/RabbitMQ/Kafka", "criar uma lambda", "acessar o banco direto do Next".
- Revisar um PR que mexe em mais de um app ou cria importações cruzadas.
- Tomar uma decisão difícil de reverter (provedor de mapas, storage de fotos, estratégia de sessão).

## Estrutura de referência

```
rotas/
├── apps/
│   ├── api/            # NestJS + Prisma + Socket.IO (Render)
│   ├── admin/          # Next.js App Router + Tailwind + shadcn/ui (Vercel)
│   └── driver/         # React Native + Expo, Android (EAS Build)
├── packages/
│   └── shared/         # Zod schemas, enums, tipos inferidos, eventos, links externos
├── docs/
│   ├── adr/            # decisões arquiteturais numeradas
│   └── skills-guide.md
├── .claude/skills/     # estas skills
├── pnpm-workspace.yaml
└── package.json        # scripts agregados: lint, typecheck, test, build
```

Gerenciador: pnpm workspaces. Não adicione Turborepo, Nx ou Lerna até que o tempo de build justifique (registre em ADR).

### Direção das dependências

```
apps/admin  ──┐
apps/driver ──┼──► packages/shared
apps/api    ──┘
```

- `packages/shared` não importa nada de `apps/*` e não depende de NestJS, Prisma, React, React Native nem Next. Só TypeScript e Zod.
- Nenhum app importa código de outro app.
- Tipos gerados pelo Prisma (`@prisma/client`) não saem de `apps/api`. A resposta da API é descrita por schemas em `packages/shared`, e o service mapeia o modelo Prisma para esse formato.

### Módulos da API (monólito modular)

| Módulo | Responsabilidade | Etapa |
|---|---|---|
| `auth` | login, refresh, logout, troca de senha | MVP |
| `usuarios` | contas e perfis (ADMIN, MOTORISTA) | MVP |
| `empresas` | cadastro de empresas clientes | MVP |
| `motoristas` | cadastro de motoristas | MVP |
| `rotas` | montagem, edição, envio, cancelamento, duplicação | MVP |
| `execucao` | comandos do motorista: receber, iniciar, chegar, concluir serviço | MVP |
| `ocorrencias` | registro e consulta de ocorrências | MVP (básico) |
| `historico` | eventos de rota (append-only) e consultas | MVP |
| `tempo-real` | gateway Socket.IO | MVP (mínimo) |
| `mapas` | adaptador de geocodificação e estimativas | MVP (links) / Etapa 2 |
| `comprovantes` | foto, assinatura, recebedor | Etapa 2 |
| `rastreamento` | posições do motorista | Etapa 2 |
| `relatorios` | indicadores agregados | MVP básico / Etapa 2 |
| `saude` | health checks | MVP |

Regras entre módulos:
- Um módulo usa outro só pelo service exportado no `exports` do módulo. Nunca importe arquivos internos (`dominio/`, `dto/`) de outro módulo.
- Dependência circular entre módulos (inclusive via `forwardRef`) é sinal de fronteira errada: mova a responsabilidade ou emita um evento interno (`EventEmitter2` só se já estiver no projeto; senão, chame o service diretamente).
- `rotas` e `execucao` compartilham o mesmo modelo de dados, mas a máquina de estados fica em um só lugar (`rotas/dominio/`), conforme `delivery-domain-rules`.

## Convenções globais de nomes

- Domínio em português sem acento: `Rota`, `Parada`, `Servico`, `Empresa`, `Motorista`, `Ocorrencia`, `Comprovante`.
- Termos de framework em inglês: `controller`, `service`, `module`, `guard`, `pipe`, `hook`.
- Arquivos em kebab-case: `rotas.controller.ts`, `use-rota-ativa.ts`.
- Enums de status em MAIÚSCULAS: `EM_ANDAMENTO`, `NAO_REALIZADO`.
- Rotas HTTP no plural e em português: `/empresas`, `/rotas/:id/paradas`. Comandos do motorista como sub-recurso de ação: `POST /motorista/rotas/:id/iniciar`.
- Eventos Socket.IO no formato `entidade.acao` no passado: `rota.enviada`, `parada.finalizada`, definidos como constantes em `packages/shared/src/eventos.ts`.

## Procedimento

1. Leia a estrutura real: `ls`, `pnpm-workspace.yaml`, `package.json` de cada app e `docs/adr/`. Não presuma que a estrutura de referência já existe.
2. Classifique a mudança: (a) cabe em módulo existente; (b) exige módulo novo; (c) exige app/pacote/serviço novo; (d) exige dependência nova.
3. Para (a): siga a skill de implementação correspondente.
4. Para (b): confirme que o módulo tem dono claro de dados e não duplica outro. Crie-o no padrão de `nestjs-backend`.
5. Para (c): só com justificativa escrita em ADR e aprovação do usuário.
6. Para (d): verifique se já há solução no projeto ou na plataforma (ex.: `fetch` nativo em vez de `axios`; `Intl.DateTimeFormat` em vez de lib de datas para formatação simples). Se instalar, use a versão estável atual, instale só no app que usa e diga no resumo por que é necessária.
7. Se a decisão for difícil de reverter, escreva o ADR antes de implementar.
8. Ao terminar, revise importações: `grep` por `from '../../` cruzando módulos e por `@prisma/client` fora de `apps/api`.

## ADRs

Arquivo `docs/adr/NNNN-titulo-curto.md`, numeração sequencial, nunca reescreva um ADR aceito — crie outro que o substitua.

```markdown
# 0003 — Provedor de mapas e geocodificação

- Status: proposto | aceito | substituído por 00XX
- Data: AAAA-MM-DD

## Contexto
O que força a decisão, restrições (custo, limites de API, LGPD).

## Decisão
O que foi escolhido, em uma frase, e os detalhes que importam.

## Alternativas consideradas
Cada uma com o motivo de não ter sido escolhida.

## Consequências
O que fica mais fácil, o que fica mais difícil, o que precisa ser revisto e quando.
```

Decisões que exigem ADR quando forem tomadas: monorepo e monólito modular; estratégia de sessão (JWT + refresh); provedor de mapas/geocodificação; storage de fotos e assinaturas; geração da documentação OpenAPI; estratégia offline do app; qualquer serviço de infraestrutura novo.

## Quando reconsiderar microsserviços ou filas

Somente se houver evidência medida (não hipótese) de pelo menos um destes: um módulo precisa escalar de forma independente e o monólito não comporta mesmo com mais instâncias; um processamento longo (otimização de rotas, geração de relatório pesado) bloqueia requisições HTTP de forma mensurável; exigência de isolamento de dados por contrato. Mesmo assim, a primeira opção é um worker no mesmo repositório usando o mesmo banco, não um serviço separado.

## Erros a evitar

- Criar `packages/ui` compartilhado entre Next e React Native: as primitivas são diferentes; compartilhe só tipos e lógica pura.
- Criar camada de "repository" genérica sobre o Prisma ou classes base abstratas "para o futuro".
- Colocar regra de negócio em Next.js Route Handlers ou Server Actions.
- Duplicar enums de status em cada app em vez de importar de `packages/shared`.
- Expor o modelo Prisma inteiro na resposta da API (vaza campos internos como `senhaHash`).
- Usar `forwardRef` para resolver ciclo entre módulos.

## Critérios de conclusão

- [ ] Nenhum import de `apps/*` dentro de `packages/shared` e nenhum import entre apps.
- [ ] `@prisma/client` aparece apenas em `apps/api`.
- [ ] Toda dependência nova tem justificativa no resumo/PR; estruturais têm ADR.
- [ ] Módulo novo tem responsabilidade descrita na tabela desta skill (atualize a tabela).
- [ ] Nenhum serviço de infraestrutura novo sem ADR aceito.
- [ ] Esta skill foi atualizada se a estrutura real mudou.

## Exemplos

**Pedido:** "Coloque a criação de rota numa Server Action do Next que grava direto no Postgres, fica mais rápido."
**Resposta correta:** recusar a gravação direta; a Server Action (se usada) apenas chama `POST /rotas` da API. Motivo: as regras de estado, autorização e histórico vivem na API.

**Pedido:** "Precisamos de notificação quando a rota for enviada."
**Encaminhamento:** o módulo `rotas` chama o service do módulo de notificações (Etapa 2) após o commit da transação; o gateway `tempo-real` emite `rota.enviada` para a sala do motorista. Sem fila externa no MVP.

**Pedido:** "Instalar `lodash` para ordenar paradas."
**Resposta correta:** usar `Array.prototype.toSorted`/`sort` com comparador; não instalar.

## Integração com outras skills

- Toda skill que criar arquivo em lugar novo consulta esta primeiro.
- `postgres-prisma-data` e `delivery-domain-rules` definem o conteúdo de `rotas/dominio` e do schema; esta skill define apenas onde ficam.
- `devops-documentation` documenta a estrutura no README; mudanças estruturais aqui exigem atualizar o README.

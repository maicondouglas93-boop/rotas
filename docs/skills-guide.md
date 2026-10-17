# Guia das skills do Claude Code — Sistema de Gestão de Rotas e Entregas

Este projeto tem 10 skills em `.claude/skills/<nome>/SKILL.md`. Cada uma orienta o Claude Code em uma área do sistema (arquitetura, API, banco, segurança, painel, app, domínio, mapas, testes, implantação). Elas não contêm código do sistema: são instruções de trabalho.

## As 10 skills

| Skill | Cuida de | Use quando |
|---|---|---|
| `architecture-guardian` | estrutura do monorepo, fronteiras entre apps e módulos, dependências novas, ADRs | criar app/módulo/pacote, adicionar dependência, alguém propor microsserviço ou fila, dúvida sobre onde o código fica |
| `nestjs-backend` | controllers, services, validação Zod, envelope de erro, transações de caso de uso, idempotência, Socket.IO | criar ou alterar endpoint, service ou evento em tempo real |
| `postgres-prisma-data` | `schema.prisma`, migrations, índices, restrições, consultas, transações, histórico | mexer em model, migration, seed, listagem ou relatório |
| `auth-security-lgpd` | login, JWT/refresh, perfis, isolamento entre motoristas, segurança da API, LGPD | login/sessão, permissões, upload, localização, logs com dados pessoais, segredos |
| `admin-dashboard-ui` | painel Next.js: páginas, tabelas, formulários, montagem de rota, acompanhamento | qualquer tela ou componente do painel |
| `react-native-driver-app` | app Expo: telas, execução de paradas, fila offline, Waze/WhatsApp, permissões | qualquer tela ou fluxo do app do motorista |
| `delivery-domain-rules` | estados e transições de rota/parada/serviço, edição, transferência, ocorrências, indicadores | qualquer mudança de status, regra de edição ou cálculo de indicador |
| `maps-route-planning` | provedor de mapas, geocodificação, links externos, estimativas, sugestão/otimização de ordem | coordenadas, mapa, links, distância/tempo, "otimizar rota" |
| `testing-quality` | testes obrigatórios por tipo de mudança, comandos de verificação, relatório | ao terminar qualquer tarefa e ao escrever testes |
| `devops-documentation` | ambiente local, variáveis, README/docs, OpenAPI, CI, deploy, logs, health, backups | configurar ambiente, CI, deploy, logs, backup ou escrever documentação |

### Quem decide o quê (para evitar conflito entre skills)

| Assunto | Dona | As outras apenas… |
|---|---|---|
| Estados, transições, indicadores | `delivery-domain-rules` | implementam, persistem, exibem e testam |
| Onde cada código fica, dependências, ADRs | `architecture-guardian` | seguem a estrutura |
| Envelope de erro, paginação, idempotência no HTTP | `nestjs-backend` | consomem |
| Modelo de dados, migrations, padrões de consulta | `postgres-prisma-data` | usam |
| Quem pode acessar o quê, tokens, dados pessoais, lista de redação de logs | `auth-security-lgpd` | aplicam |
| Links de Waze/Google Maps/WhatsApp, estimativas, ordem sugerida | `maps-route-planning` | chamam os construtores |
| Testes obrigatórios e formato do relatório de verificação | `testing-quality` | apontam para ela nos critérios de conclusão |
| `docs/` (exceto ADRs), CI, deploy, logger, backups | `devops-documentation` | atualizam quando mudam algo documentado |

## Como as skills são carregadas

O Claude Code **não** carrega o conteúdo completo de todas as skills em toda conversa.

- **No início da sessão** entram no contexto só o `name` e a `description` de cada skill. É assim que o Claude sabe que elas existem.
- **O corpo do `SKILL.md`** só entra quando a skill é invocada — por você (comando `/nome`) ou pelo próprio Claude, quando o pedido combina com a `description`.
- Depois de carregada, a skill fica na conversa nos turnos seguintes. Se a conversa for compactada, só o início de cada skill invocada é preservado; por isso as regras mais importantes estão no topo de cada arquivo, na seção "Regras que valem sempre". Se notar que o Claude deixou de seguir uma skill depois de uma conversa longa, invoque-a de novo.
- **Invocação explícita** (`/nome-da-skill`) garante o carregamento. **Invocação automática** depende do pedido combinar com a descrição — não é garantida. Nenhuma destas skills usa `disable-model-invocation`, então as duas formas estão disponíveis.
- Regras que precisam valer em **toda** conversa, sem depender de invocação, devem ir para um `CLAUDE.md` na raiz (sempre carregado) ou para hooks (executados pelo Claude Code em todo evento configurado). Este projeto ainda não tem `CLAUDE.md`.

## Como invocar

Digite o nome da skill **no início** da mensagem, seguido do pedido:

```
/delivery-domain-rules como deve funcionar a transferência de uma rota em andamento?
/nestjs-backend implemente POST /motorista/paradas/:id/cheguei
/admin-dashboard-ui crie a tela de lista de empresas com busca e paginação
/testing-quality revise os testes do módulo de execução
```

Pedidos sem barra também funcionam quando são específicos o bastante para combinar com a descrição — por exemplo, "crie a migration da tabela de ocorrências" tende a carregar `postgres-prisma-data`. Para ter certeza, use a barra.

## Como verificar se as skills foram reconhecidas

1. Rode `/skills` no Claude Code: a lista deve mostrar as 10 skills deste projeto. `/context` também mostra as skills carregadas na listagem.
2. Pergunte "Quais skills estão disponíveis?" — o Claude responde a partir da listagem.
3. Se a pasta `.claude/skills/` foi criada com a sessão já aberta, rode `/reload-skills` (edições em `SKILL.md` existentes são recarregadas sozinhas).
4. Se `/nome-da-skill` não for reconhecido, rode `claude --debug` e procure erros de nome ou de frontmatter no log. Em versões do Claude Code a partir da 2.1.233, `claude plugin validate .claude/skills` aponta frontmatter inválido.
5. `/skill-doctor` (versões recentes) mostra o custo de contexto e quais skills nunca foram usadas.

## Como escolher a skill

| Tarefa | Skill principal | Também carregar |
|---|---|---|
| Criar o esqueleto do monorepo | `architecture-guardian` | `devops-documentation` |
| Cadastro de empresas (API + tela) | `nestjs-backend` | `postgres-prisma-data`, `admin-dashboard-ui`, `maps-route-planning` |
| Enviar rota ao motorista | `delivery-domain-rules` | `nestjs-backend`, `admin-dashboard-ui` |
| Tela de execução da parada no app | `react-native-driver-app` | `delivery-domain-rules` |
| Login e refresh de sessão | `auth-security-lgpd` | `nestjs-backend`, `testing-quality` |
| Relatório de produtividade | `delivery-domain-rules` (definição) | `postgres-prisma-data` (SQL), `admin-dashboard-ui` |
| Botão "Abrir no Waze" | `maps-route-planning` | `react-native-driver-app` ou `admin-dashboard-ui` |
| Fotos e assinatura (Etapa 2) | `auth-security-lgpd` | `react-native-driver-app`, `nestjs-backend`, `architecture-guardian` (ADR de storage) |
| Rastreamento em tempo real (Etapa 2) | `auth-security-lgpd` | `react-native-driver-app`, `nestjs-backend`, `maps-route-planning` |
| Configurar CI e deploy | `devops-documentation` | `testing-quality` |
| Fechar qualquer tarefa | `testing-quality` | — |

Regra prática: se a tarefa muda status de algo, comece por `delivery-domain-rules`; se cria lugar novo para código ou instala pacote, passe por `architecture-guardian`; sempre termine com `testing-quality`.

## Usando duas ou mais skills na mesma tarefa

O comando com barra no início da mensagem executa **uma** skill. Para combinar:

- **Sequência explícita (garante o carregamento):** envie uma mensagem por skill antes do pedido principal, ou invoque a principal e, na mensagem seguinte, a complementar.
  ```
  /delivery-domain-rules vamos implementar a transferência de rota em andamento
  /nestjs-backend implemente o endpoint conforme as regras acima
  /testing-quality escreva e rode os testes dessa mudança
  ```
- **Citação no pedido:** invoque a principal e cite as outras pelo nome — "/nestjs-backend implemente a transferência seguindo delivery-domain-rules e testing-quality". Citar o nome permite que o Claude carregue a skill, mas não força; confira na resposta se ela foi usada.

Se duas skills parecerem dizer coisas diferentes, vale a tabela "Quem decide o quê" acima. Se a contradição for real, corrija as skills (veja abaixo) em vez de escolher uma no improviso.

## Mantendo as skills sincronizadas com o projeto

- As skills descrevem uma estrutura de referência (`apps/api`, `apps/admin`, `apps/driver`, `packages/shared`). Quando o código real for criado e divergir, **o código vence** e a skill é atualizada no mesmo PR.
- Mudou uma decisão de arquitetura → novo ADR em `docs/adr/` + atualização da skill afetada no mesmo PR.
- Mudou um status, transição ou indicador → atualize primeiro `delivery-domain-rules`, depois o código.
- Novo dado pessoal ou campo sensível → atualize o inventário e a lista de redação em `auth-security-lgpd`.
- Nova variável de ambiente, comando ou procedimento → `devops-documentation` e `docs/`.
- Mantenha cada `SKILL.md` com menos de 500 linhas; detalhes longos vão para arquivos de apoio na pasta da skill, referenciados no `SKILL.md`.
- A `description` é o que faz a skill ser encontrada: comece pelo caso de uso principal e use palavras que aparecem nos pedidos ("rota", "parada", "migration", "tela", "login").
- Revisão periódica: rode `/skill-doctor` e ajuste descrições de skills que nunca são carregadas.

## Estado atual

- A pasta do projeto ainda não tem código do sistema; existem apenas as skills e este guia.
- Decisões ainda pendentes, que viram ADR quando forem tomadas: provedor de mapas e geocodificação; storage de fotos e assinaturas; geração do OpenAPI a partir do Zod; domínio de produção (afeta o cookie de sessão); estratégia de atualização OTA do app.
- Sugestão: ao iniciar o código, criar um `CLAUDE.md` curto na raiz com as regras que devem valer sempre (stack, "regra de negócio só na API", "rode os testes antes de concluir") e um apontamento para este guia.

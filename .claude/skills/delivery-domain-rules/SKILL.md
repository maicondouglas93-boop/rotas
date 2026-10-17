---
name: delivery-domain-rules
description: Fonte única das regras de negócio de rotas, paradas, coletas e entregas — estados válidos, transições permitidas, quem pode executar cada ação, edição e reordenação de rotas, atribuição e transferência entre motoristas, ocorrências, histórico operacional e definição dos indicadores de relatório. Use antes de implementar ou alterar qualquer mudança de status, regra de edição de rota, fluxo do motorista ou cálculo de indicador.
---

# delivery-domain-rules

## Regras que valem sempre (leia primeiro)

1. Três níveis com status próprios: **Rota** (o percurso), **Parada** (a visita a uma empresa) e **Serviço** (coleta ou entrega naquela parada). Concluir um não é o mesmo que concluir o outro.
2. Status só muda por **comando nomeado** (enviar, iniciar, chegar, realizar...) validado pela tabela de transições abaixo. Não existe "setar status".
3. Toda transição gera um `RotaEvento` na mesma transação. O histórico é append-only.
4. `NAO_REALIZADO` exige ocorrência. Cancelamento exige motivo.
5. Paradas e serviços já finalizados nunca são alterados, removidos ou reordenados.
6. Uma rota pertence a no máximo um motorista por vez; cada serviço registra quem o executou.
7. As regras ficam em funções puras em `apps/api/src/modulos/rotas/dominio/`, sem Prisma e sem Nest, com testes de tabela.

## Objetivo e escopo

Responsável por: vocabulário do domínio, máquina de estados, invariantes, permissões por ator em cada ação, regras de edição/reordenação/transferência, tipos de ocorrência, tipos de evento de histórico, definição dos indicadores.

Fora do escopo: como persistir (`postgres-prisma-data`), como expor em HTTP (`nestjs-backend`), como verificar identidade (`auth-security-lgpd`), como exibir (`admin-dashboard-ui`, `react-native-driver-app`).

## Quando usar

- Implementar qualquer botão ou endpoint que muda status.
- Permitir edição de rota já enviada ou em andamento.
- Implementar transferência de motorista, cancelamento, duplicação ou recorrência.
- Definir o que um número do relatório significa.
- Quando o app e o painel discordarem sobre o estado de algo.

## Vocabulário

- **Empresa:** cliente cadastrado onde se coleta e/ou entrega.
- **Rota:** conjunto ordenado de paradas para uma data, atribuído a um motorista.
- **Parada:** visita a uma empresa dentro da rota, com posição na sequência.
- **Serviço:** `COLETA` ou `ENTREGA` dentro de uma parada. Parada "ambas" = dois serviços.
- **Ocorrência:** registro de problema (endereço incorreto, empresa fechada...).
- **Evento:** linha do histórico com o que mudou, quando e quem fez.

## Estados

Os enums ficam em `packages/shared/src/dominio/status.ts` e são espelhados no Prisma.

**Rota:** `RASCUNHO` → `ENVIADA` → `RECEBIDA` → `EM_ANDAMENTO` → `CONCLUIDA`; `CANCELADA` a partir de qualquer não terminal.
**Parada:** `PENDENTE` → `A_CAMINHO` → `NO_LOCAL` → `FINALIZADA`; `CANCELADA`.
**Serviço:** `PENDENTE` → `REALIZADO` | `NAO_REALIZADO`; `CANCELADO`.

Terminais: Rota `CONCLUIDA`, `CANCELADA`; Parada `FINALIZADA`, `CANCELADA`; Serviço `REALIZADO`, `NAO_REALIZADO`, `CANCELADO`.

## Transições da rota

| Comando | De | Para | Ator | Pré-condições |
|---|---|---|---|---|
| `ENVIAR` | `RASCUNHO` | `ENVIADA` | admin | motorista ativo definido; ≥ 1 parada; toda parada com ≥ 1 serviço; nenhuma empresa arquivada |
| `CONFIRMAR_RECEBIMENTO` | `ENVIADA` | `RECEBIDA` | motorista da rota | — |
| `INICIAR` | `RECEBIDA` | `EM_ANDAMENTO` | motorista da rota | motorista não tem outra rota `EM_ANDAMENTO` |
| `CONCLUIR` (automático) | `EM_ANDAMENTO` | `CONCLUIDA` | sistema | todas as paradas terminais; ocorre na mesma transação que finaliza a última parada |
| `CANCELAR` | qualquer não terminal | `CANCELADA` | admin | motivo obrigatório; paradas não terminais → `CANCELADA`, serviços pendentes → `CANCELADO` |
| `TRANSFERIR` | `ENVIADA`, `RECEBIDA`, `EM_ANDAMENTO` | `ENVIADA` | admin | novo motorista ativo e diferente do atual; motivo obrigatório |
| `EDITAR_ESTRUTURA` | `RASCUNHO` | `RASCUNHO` | admin | — (montagem livre) |
| `EDITAR_ESTRUTURA` | `ENVIADA`, `RECEBIDA` | `ENVIADA` | admin | motorista é notificado e precisa reconfirmar |
| `EDITAR_ESTRUTURA` | `EM_ANDAMENTO` | `EM_ANDAMENTO` | admin | só afeta paradas `PENDENTE` (ver edição) |
| `EXCLUIR` | `RASCUNHO` | (removida) | admin | única exclusão física permitida |

## Transições da parada e do serviço

| Comando | Entidade | De | Para | Ator | Pré-condições |
|---|---|---|---|---|---|
| `SEGUIR_PARA` | Parada | `PENDENTE` | `A_CAMINHO` | motorista | rota `EM_ANDAMENTO`; se outra parada estiver `A_CAMINHO`, ela volta para `PENDENTE` na mesma transação |
| `VOLTAR_PARA_FILA` | Parada | `A_CAMINHO` | `PENDENTE` | motorista | rota `EM_ANDAMENTO` |
| `CHEGAR` | Parada | `A_CAMINHO` | `NO_LOCAL` | motorista | rota `EM_ANDAMENTO`; nenhuma outra parada `NO_LOCAL` na rota |
| `REALIZAR` | Serviço | `PENDENTE` | `REALIZADO` | motorista | parada `NO_LOCAL`; grava `executadoPorMotoristaId` e `concluidoEm` |
| `NAO_REALIZAR` | Serviço | `PENDENTE` | `NAO_REALIZADO` | motorista | parada `A_CAMINHO` ou `NO_LOCAL`; ocorrência criada junto |
| (automático) | Parada | `NO_LOCAL` ou `A_CAMINHO` | `FINALIZADA` | sistema | todos os serviços da parada terminais |
| `CANCELAR_PARADA` | Parada | `PENDENTE`, `A_CAMINHO` | `CANCELADA` | admin | rota `EM_ANDAMENTO`; motivo; serviços pendentes → `CANCELADO`. Antes do início, a parada é removida por `EDITAR_ESTRUTURA` |

Implementação: `apps/api/src/modulos/rotas/dominio/transicoes.ts` (`transicaoRota`, `transicaoParada`, `transicaoServico`, `paradaDeveFinalizar`, `rotaDeveConcluir`). Essas funções checam só status, comando e ator; as pré-condições que dependem de outros dados são validadas à parte.

Invariantes derivadas:
- No máximo **uma** parada ativa (`A_CAMINHO` ou `NO_LOCAL`) por rota.
- O motorista pode executar as paradas fora da ordem sugerida; a sequência é orientação, não trava. O evento registra a ordem real.
- `NO_LOCAL` só aceita `REALIZAR`/`NAO_REALIZAR`; não volta para `A_CAMINHO`.

## Edição de rota

| Status da rota | Pode | Não pode |
|---|---|---|
| `RASCUNHO` | tudo | — |
| `ENVIADA` / `RECEBIDA` | adicionar/remover paradas, reordenar, mudar serviços e observações, trocar data — a rota volta para `ENVIADA` e o motorista reconfirma | — |
| `EM_ANDAMENTO` | adicionar parada (entra como `PENDENTE`), cancelar parada `PENDENTE`/`A_CAMINHO`, reordenar só as `PENDENTE`, editar observação de parada não finalizada | mexer em parada `NO_LOCAL`/`FINALIZADA`; trocar data |
| `CONCLUIDA` / `CANCELADA` | nada (apenas consulta) | qualquer alteração |

Toda edição: confere `versao`, incrementa `versao`, gera evento `ROTA_EDITADA` com o resumo da diferença (`{ adicionadas, removidas, reordenadas }`) e avisa o motorista em tempo real.

**Snapshot da empresa na parada:** copiado ao adicionar a parada. Enquanto a rota estiver em `RASCUNHO`, o admin pode atualizar o snapshot a partir do cadastro ("Atualizar dados da empresa"). Depois de `ENVIADA`, só muda por edição explícita e gera evento.

## Atribuição e transferência

- Atribuir motorista é parte da montagem (`RASCUNHO`). O motorista só vê a rota a partir de `ENVIADA`.
- Transferir (`TRANSFERIR`): rota volta para `ENVIADA` para o novo motorista, que precisa confirmar e iniciar. Paradas e serviços terminais mantêm `executadoPorMotoristaId` original; parada ativa do motorista anterior volta para `PENDENTE`.
- O motorista anterior perde acesso à rota imediatamente; o evento `ROTA_TRANSFERIDA` guarda `{ deMotoristaId, paraMotoristaId, motivo }`.
- Motorista desativado com rota não terminal: a rota não muda sozinha; o painel destaca "rota sem motorista ativo" para o admin transferir ou cancelar.

## Ocorrências

Tipos (`TipoOcorrencia`): `ENDERECO_INCORRETO`, `EMPRESA_FECHADA`, `CLIENTE_AUSENTE`, `RECUSA_RECEBIMENTO`, `MERCADORIA_INDISPONIVEL`, `ENTREGA_NAO_REALIZADA`, `OUTRO`. `OUTRO` exige descrição (10–500 caracteres).

- Ocorrência pode ser registrada em parada `A_CAMINHO` ou `NO_LOCAL` sem encerrar serviço (informativa), ou junto com `NAO_REALIZAR` (obrigatória).
- Ocorrência não é editada nem apagada; correção = nova ocorrência referenciando a anterior.

## Eventos de histórico (`TipoEventoRota`)

`ROTA_CRIADA`, `ROTA_EDITADA`, `ROTA_ENVIADA`, `ROTA_RECEBIDA`, `ROTA_INICIADA`, `ROTA_CONCLUIDA`, `ROTA_CANCELADA`, `ROTA_TRANSFERIDA`, `PARADA_A_CAMINHO`, `PARADA_RETORNOU_FILA`, `PARADA_CHEGADA`, `PARADA_FINALIZADA`, `PARADA_CANCELADA`, `SERVICO_REALIZADO`, `SERVICO_NAO_REALIZADO`, `OCORRENCIA_REGISTRADA`.

Cada evento grava `autorUsuarioId` (nulo quando automático), `statusAnterior`, `statusNovo`, `ocorridoEm` (dispositivo, quando houver) e `criadoEm` (servidor).

## Comandos repetidos e conectividade

- Comandos do motorista são idempotentes: o mesmo `Idempotency-Key` devolve o mesmo resultado.
- Comando cujo estado de destino já foi atingido (ex.: `CHEGAR` em parada já `NO_LOCAL`) responde sucesso com o estado atual, sem novo evento.
- Comando que ficou inválido porque o admin mudou a rota (ex.: parada cancelada enquanto o app estava offline) responde `TRANSICAO_INVALIDA` com o estado atual; o app mostra a mensagem e descarta o comando.

## Reutilização e recorrência

- **Duplicar:** cria nova rota `RASCUNHO` com as mesmas empresas, ordem, serviços e observações; snapshot renovado do cadastro atual; sem motorista e sem horários. Empresas arquivadas são omitidas e listadas para o admin.
- **Recorrente (Etapa 2):** `RotaModelo` com regra de recorrência (dias da semana). Uma rotina diária gera rotas `RASCUNHO` (nunca `ENVIADA` automaticamente) para o admin revisar.

## Definição dos indicadores

| Indicador | Definição |
|---|---|
| Rotas realizadas | rotas `CONCLUIDA` com `concluidaEm` no período |
| Coletas / entregas | serviços do tipo, não cancelados, de rotas não `RASCUNHO`, no período por `dataPrevista` |
| Entregas concluídas | serviços `ENTREGA` com status `REALIZADO` |
| Entregas não realizadas | serviços `ENTREGA` com status `NAO_REALIZADO` (cancelados não contam) |
| Taxa de sucesso | `REALIZADO / (REALIZADO + NAO_REALIZADO)` por tipo |
| Tempo da rota | `concluidaEm − iniciadaEm` |
| Distância estimada | valor gravado na rota no envio; distância percorrida só quando houver rastreamento |
| Produtividade do motorista | serviços `REALIZADO` por `executadoPorMotoristaId` no período e tempo médio por parada |
| Histórico por empresa | paradas de rotas não `RASCUNHO` com aquela `empresaId` |

## Erros a evitar

- Considerar a rota concluída quando o motorista "toca em finalizar" com paradas pendentes.
- Marcar a parada como finalizada ao realizar só a coleta numa parada "ambas".
- Reordenar paradas `FINALIZADA` para "ficar bonito" no histórico (o histórico usa a ordem real dos eventos).
- Atribuir produtividade ao motorista atual da rota em vez de `executadoPorMotoristaId`.
- Duplicar a máquina de estados no app ou no painel com regras próprias. Clientes usam um mapa simples "ações disponíveis por status" vindo de `packages/shared` e a API decide.

## Critérios de conclusão

- [ ] Toda transição nova está nas tabelas desta skill e em `dominio/transicoes.ts`.
- [ ] Teste de tabela cobre todos os pares (status, comando): permitido e proibido.
- [ ] Transição grava evento com o tipo correto.
- [ ] Indicador novo tem definição nesta tabela antes de ser implementado.
- [ ] Painel e app mostram apenas ações permitidas para o status atual.

## Exemplos

**Parada "ambas" com coleta feita e entrega recusada:** `REALIZAR` (coleta) → serviço `REALIZADO`, parada continua `NO_LOCAL`; `NAO_REALIZAR` (entrega) + ocorrência `RECUSA_RECEBIMENTO` → serviço `NAO_REALIZADO`; todos terminais → parada `FINALIZADA`; se era a última, rota `CONCLUIDA`. Quatro eventos.

**Admin adiciona parada com a rota em andamento:** permitido; nova parada `PENDENTE` com `sequencia` = maior + 1; `versao` incrementa; evento `ROTA_EDITADA`; app recebe `rota.editada` e recarrega.

**Motorista tenta iniciar a segunda rota do dia com a primeira em andamento:** `TRANSICAO_INVALIDA` com mensagem "Conclua a rota em andamento antes de iniciar outra."

## Integração com outras skills

- `nestjs-backend` chama estas funções nos services; `postgres-prisma-data` implementa enums, colunas e o compare-and-set.
- `auth-security-lgpd` usa "motorista da rota" para o controle de acesso.
- `react-native-driver-app` e `admin-dashboard-ui` exibem as ações permitidas por status.
- `testing-quality` exige o teste de tabela de transições.
- `maps-route-planning` define o campo `ordemOrigem` e a sugestão de ordem; a regra de que a sequência não trava a execução fica aqui.

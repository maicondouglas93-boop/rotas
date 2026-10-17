---
name: admin-dashboard-ui
description: Constrói o painel administrativo Next.js do sistema de rotas e entregas (apps/admin) com Tailwind e shadcn/ui — telas de empresas, motoristas, montagem de rota com arrastar e soltar e mapa, acompanhamento em tempo real, histórico e relatórios; formulários, tabelas, filtros, paginação, diálogos, estados de carregamento e erro, responsividade e acessibilidade. Use ao criar ou alterar qualquer página, componente ou fluxo do painel.
---

# admin-dashboard-ui

## Regras que valem sempre (leia primeiro)

1. O painel não tem regra de negócio nem acesso ao banco: busca e grava via API (`lib/api.ts`). Ações disponíveis em cada status vêm do mapa de `packages/shared`; a API tem a palavra final.
2. Formulários usam os mesmos schemas Zod de `packages/shared` (react-hook-form + `zodResolver`). Erros de campo da API (`erro.detalhes`) aparecem no campo correspondente.
3. Toda lista tem os quatro estados: carregando (skeleton), vazia (com ação), erro (com "Tentar novamente") e com dados.
4. Toda ação irreversível ou que afeta o motorista (enviar, cancelar, transferir, arquivar) pede confirmação em `AlertDialog` com o efeito descrito.
5. Componentes de `components/ui/` são os do shadcn; customize por variantes e tokens, não reescrevendo o componente em cada página.
6. Interface em português do Brasil; datas, números e horários com `Intl` em `pt-BR` e fuso `America/Sao_Paulo`.

## Objetivo e escopo

Responsável por: estrutura de rotas do App Router, layout, componentes de domínio do painel, busca de dados no cliente, formulários, tabelas, mapa da montagem de rota, consumo de eventos Socket.IO, padrões visuais e acessibilidade do painel.

Fora do escopo: regras de transição (`delivery-domain-rules`), armazenamento de tokens e CSRF (`auth-security-lgpd`), construção dos links de Waze/WhatsApp e escolha do provedor de mapa (`maps-route-planning`), deploy na Vercel (`devops-documentation`).

## Quando usar

- Criar ou alterar página, tabela, formulário, diálogo ou componente do painel.
- Implementar a tela de montagem de rota ou o acompanhamento em tempo real.
- Ajustar layout responsivo, tema ou acessibilidade.

## Estrutura

```
apps/admin/src/
├── app/
│   ├── (publico)/login/page.tsx
│   └── (painel)/
│       ├── layout.tsx            # sidebar + cabeçalho + verificação de sessão
│       ├── page.tsx              # "Hoje": rotas do dia e pendências
│       ├── rotas/ (lista, nova, [id], [id]/editar)
│       ├── empresas/ (lista, nova, [id])
│       ├── motoristas/ (lista, novo, [id])
│       ├── acompanhamento/page.tsx
│       └── relatorios/page.tsx
├── components/
│   ├── ui/                       # gerado pelo shadcn
│   └── rotas/, empresas/, motoristas/, comum/
├── lib/
│   ├── api.ts                    # fetch + refresh + envelope de erro
│   ├── consultas/                # hooks TanStack Query por domínio
│   ├── tempo-real.ts             # socket.io-client
│   └── formatos.ts               # datas, telefone, CEP, distância
└── app/globals.css               # tokens do tema
```

Páginas autenticadas são componentes cliente com TanStack Query (o access token está em memória, ver `auth-security-lgpd`). Não use Server Actions nem Route Handlers para regra de negócio.

Já existe: `lib/api.ts` (token em memória, renovação em voo único com Web Locks, nova tentativa após 401), `lib/sessao.tsx` (`useSessao`), `lib/consultas/{empresas,motoristas,rotas}.ts`, `lib/filtros-url.ts`, `components/comum/` (`CabecalhoPagina`, `ConteudoPagina`, `Vazio`, `ErroCarregamento`, `LinhasCarregando`, `Paginacao`, `StatusBadge`, `CampoBusca`, `LinksExternos`) e `components/rotas/montagem-rota.tsx`. Os componentes do shadcn usam Base UI: gatilhos recebem `render={<Button />}` (não `asChild`). `cacheComponents`/`partialPrefetching` do Next ficam desligados (painel todo no cliente). O mapa da montagem espera o ADR do provedor (`maps-route-planning`). Detalhe da rota: ocorrências do motorista vêm de `GET /rotas/:id/ocorrencias` (`useOcorrenciasRota`, fora de `rotaSchema` para não quebrar o app); enquanto a rota está `ENVIADA`/`RECEBIDA`/`EM_ANDAMENTO`, detalhe, histórico e ocorrências recarregam a cada 20 s (`rotaEmExecucao`) até existir o tempo real.

## Padrões

### Dados

- Renovação de sessão em voo único: só uma chamada a `/auth/refresh` por vez, compartilhada entre abas (Web Locks API `navigator.locks`, com fallback de uma promessa por aba). Requisições que recebem 401 esperam essa renovação e repetem uma vez; se a renovação falhar, vai para o login.
- Chaves de consulta: `['rotas', 'lista', filtros]`, `['rotas', id]`, `['empresas', 'busca', termo]`.
- Após mutação, invalide as chaves afetadas; não edite cache manualmente salvo em reordenação (otimista com rollback).
- Filtros, página e ordenação ficam na URL (`useSearchParams`) para o botão voltar e o link compartilhado funcionarem.
- Paginação no servidor (`pagina`, `porPagina`); a tabela nunca carrega tudo.
- `409 CONFLITO_VERSAO` → banner "Esta rota foi alterada por outra pessoa." com botão "Carregar versão atual"; nunca sobrescrever.

### Formulários

- Botão de envio com rótulo da ação ("Salvar empresa", "Enviar para Marcos"), desabilitado e com indicador enquanto a mutação está pendente.
- Em erro, o formulário mantém os valores digitados.
- Máscaras de telefone, CEP e CPF/CNPJ só na exibição/entrada; o valor enviado é normalizado (só dígitos ou E.164).
- CEP preenche endereço só se houver serviço de CEP aprovado em ADR; sem ele, campos manuais.

### Tabelas

- shadcn Data Table (TanStack Table) com colunas específicas, não genéricas: Rotas → Data, Nome, Motorista, Paradas (feitas/total), Status, Atualizado.
- Ações da linha em menu `DropdownMenu`; a ação principal (ex.: "Abrir") é o clique na linha.
- Linhas com altura ~44 px, números com `tabular-nums`, alinhamento à direita para números.
- Abaixo de `md`, tabelas viram lista de cartões com os 3–4 campos principais.

### Status

Um único componente `<StatusBadge tipo="rota" status={...} />` com mapa fixo de cor + texto. Cor nunca é a única informação (sempre texto; ícone opcional).

### Links externos

```tsx
<a href={linkWhatsApp(empresa.whatsapp)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
<a href={linkWaze(parada)} target="_blank" rel="noopener noreferrer">Abrir no Waze</a>
```

Construtores vêm de `packages/shared` (`maps-route-planning`). Sem telefone/coordenada → botão desabilitado com tooltip explicando o que falta no cadastro.

## Tela de montagem de rota (prioridade)

Layout em duas colunas no desktop (lista à esquerda, mapa à direita); no celular, lista primeiro e mapa recolhível.

1. Cabeçalho: nome, data prevista, motorista (combobox só com motoristas ativos).
2. "Adicionar empresas": `Command` com busca por nome, bairro ou cidade; empresas já na rota aparecem marcadas; arquivadas não aparecem.
3. Lista de paradas ordenável com `@dnd-kit/sortable`: número da sequência, nome, endereço curto, seletor de serviço (Coleta / Entrega / Ambas), campo de observação expansível, remover.
4. Reordenação acessível: sensor de teclado do dnd-kit **e** botões "Mover para cima/baixo" no menu da parada.
5. Mapa com marcadores numerados na mesma ordem da lista; clique no marcador destaca a parada.
6. Rodapé fixo: total de paradas, distância e duração com o rótulo "estimativa" e a fonte; botões "Salvar rascunho" e "Enviar para <motorista>".
7. Em rota `EM_ANDAMENTO`, paradas finalizadas aparecem travadas (sem alça de arrastar) com status; só `PENDENTE` reordena (`delivery-domain-rules`).
8. "Sugerir ordem" só aparece quando houver implementação em `maps-route-planning`, e o texto diz exatamente o que ela faz (ex.: "Sugestão por proximidade").

## Acompanhamento em tempo real

- Conecta o socket após o login; em evento, invalida a consulta afetada (não aplica payload como estado final).
- Indicador de conexão no cabeçalho ("Ao vivo" / "Reconectando…"); desconectado → refetch a cada 30 s até reconectar.
- Cada rota mostra: motorista, início, paradas feitas/pendentes, ocorrências (destaque), conclusão, "atualizado há X min".
- Novidades anunciadas em região `aria-live="polite"` resumida ("Parada 3 de Rota Centro finalizada").

## Direção visual (evitar aparência de template gerado)

- Paleta neutra + **uma** cor de destaque para ações primárias; cores de status reservadas para status.
- Sem gradientes decorativos, glassmorphism, emojis como ícones, ilustrações genéricas ou cartões de KPI como página inicial. A página inicial é operacional: rotas de hoje, pendências e ocorrências abertas.
- Ícones `lucide-react` só quando acrescentam significado (ex.: telefone, mapa), sempre com texto ou `aria-label`.
- Escala tipográfica curta: título de página `text-xl font-semibold`, corpo e tabelas `text-sm`, metadados `text-xs text-muted-foreground`.
- Espaçamento por escala do Tailwind (múltiplos de 4); páginas com largura máxima e alinhamento consistente; cabeçalho de página sempre com título, descrição curta opcional e ação primária à direita.
- Microtexto específico do domínio: "Nenhuma rota para hoje. Criar rota" em vez de "Nenhum dado encontrado".
- Tokens de tema definidos uma vez em `globals.css` (variáveis do shadcn); nenhum hex solto nos componentes.

## Acessibilidade

- Todo campo com `<Label>`; erros ligados com `aria-describedby`.
- Foco visível em todos os elementos interativos; diálogos devolvem o foco ao fechar.
- Contraste AA (4,5:1 texto normal).
- Navegação completa por teclado, inclusive reordenação de paradas.
- Áreas de toque ≥ 40 px nas telas usadas no celular.

## Erros a evitar

- `useEffect` + `fetch` manual em cada página em vez dos hooks de consulta.
- Confirmar sucesso antes da resposta da API (exceto reordenação otimista com rollback).
- Spinner de página inteira para recarregar uma tabela.
- Desabilitar botão sem explicar por quê.
- Copiar enums de status ou regras de transição para o painel.
- Instalar biblioteca de componentes além do shadcn/ui.

## Critérios de conclusão

- [ ] Página tem os quatro estados (carregando, vazio, erro, dados).
- [ ] Formulário usa schema de `packages/shared` e mostra erros da API por campo.
- [ ] Ações irreversíveis confirmadas e com rótulo descritivo.
- [ ] Funciona em 375 px de largura sem rolagem horizontal da página.
- [ ] Navegável por teclado; sem erros de acessibilidade no Lighthouse/axe nas telas alteradas.
- [ ] `pnpm --filter admin lint typecheck test` executados e passando; fluxo crítico alterado coberto em E2E (`testing-quality`).

## Exemplos

**Cadastro de empresa:** seções "Identificação", "Contato", "Endereço e localização", "Funcionamento e observações". Após salvar endereço, a tela mostra o pin no mapa e o botão "Ajustar no mapa" (arrastar o pin grava a coordenada como `MANUAL`, `maps-route-planning`).

**Cancelar rota:** item "Cancelar rota" no menu → `AlertDialog` "Cancelar a rota Centro – 16/10? O motorista Marcos será avisado e as 4 paradas pendentes serão canceladas." + campo obrigatório "Motivo" → botão "Cancelar rota" (variante destrutiva) e "Voltar".

## Integração com outras skills

- `delivery-domain-rules`: ações por status e textos de erro de transição.
- `maps-route-planning`: componente de mapa, links e estimativas.
- `auth-security-lgpd`: sessão, refresh e exibição mascarada de documentos.
- `nestjs-backend`: envelope de erro e paginação consumidos aqui.
- `testing-quality`: testes de componente e E2E com Playwright.

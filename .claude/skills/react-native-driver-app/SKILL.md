---
name: react-native-driver-app
description: Desenvolve o aplicativo Android do motorista em React Native com Expo (apps/driver) — login, lista de rotas, detalhe da rota, execução de paradas (iniciar, cheguei, coleta realizada, entrega concluída, não realizado), ocorrências, abertura do Waze e WhatsApp, cache e fila de comandos para conexão instável, permissões Android e preparação para notificações e localização. Use ao criar ou alterar telas, navegação, chamadas à API ou permissões do app.
---

# react-native-driver-app

## Regras que valem sempre (leia primeiro)

1. O app mostra e envia comandos; quem decide se a ação vale é a API. Botões exibidos por status vêm do mapa de ações de `packages/shared`.
2. Toda ação de execução é enviada com `Idempotency-Key` (UUID gerado no momento do toque) e `ocorridoEm`. Reenvio usa a **mesma** chave.
3. Sem rede, o comando entra na fila local e a tela mostra "Aguardando conexão" na parada; nada é dado como confirmado pelo servidor até a resposta.
4. Tokens: refresh em `expo-secure-store`, access em memória. Logout limpa tokens, cache de consultas e fila. Renove a sessão uma chamada por vez (promessa única compartilhada): dois `/auth/refresh` simultâneos com o mesmo token derrubam a sessão por reuso.
5. Nenhuma permissão Android sensível (localização, câmera, notificações) no MVP. Declare uma permissão só junto com a funcionalidade que a usa.
6. Links de Waze e WhatsApp em formato `https` (universal link) vindos de `packages/shared`; sempre com tratamento de falha.

## Objetivo e escopo

Responsável por: navegação (Expo Router), telas, cliente HTTP do app, cache e persistência local, fila offline, integração com `Linking`, permissões e configuração `app.json`/`app.config.ts`, UX de campo.

Fora do escopo: regras de transição (`delivery-domain-rules`), formato dos links (`maps-route-planning`), estratégia de tokens (`auth-security-lgpd`), perfis de build EAS e publicação (`devops-documentation`).

## Quando usar

- Criar ou alterar qualquer tela ou fluxo do motorista.
- Tratar perda de conexão, reenvio ou conflito com alterações do admin.
- Adicionar permissão, notificação, câmera ou localização (Etapa 2).

## Estrutura

```
apps/driver/
├── src/
│   ├── app/                      # rotas do Expo Router (só telas e _layout)
│   │   ├── _layout.tsx           # providers + Stack
│   │   ├── (publico)/login.tsx
│   │   ├── (publico)/trocar-senha.tsx
│   │   └── (app)/
│   │       ├── _layout.tsx       # exige sessão
│   │       ├── index.tsx         # início: resumo e rotas
│   │       ├── rotas/[id].tsx    # detalhe e lista de paradas
│   │       ├── paradas/[id].tsx  # execução da parada
│   │       └── ocorrencia.tsx    # registrar ocorrência (modal)
│   ├── api/cliente.ts            # fetch + timeout + ErroApi (já existe); refresh entra com o login
│   ├── api/consultas.ts          # hooks TanStack Query
│   ├── fila/fila-comandos.ts     # fila persistida e reenvio
│   ├── sessao/                   # SecureStore + estado de sessão
│   └── componentes/
├── app.json                      # nome, pacote Android, permissions: []
└── .env.local                    # EXPO_PUBLIC_API_URL (não versionado)
```

- Código que não é tela (componentes, hooks, utilitários) fica fora de `src/app/`.
- Adicione pacotes com `pnpm exec expo install <pacote>` dentro de `apps/driver` (escolhe a versão compatível com o SDK). `pnpm exec expo install --check` confere as versões.
- Pastas `android/` e `ios/` são geradas (Continuous Native Generation): nunca edite à mão; configure por `app.json` e config plugins. Biblioteca com código nativo exige build de desenvolvimento (não roda no Expo Go).
- Antes de usar uma API do Expo, confira a documentação da versão do SDK instalada (`expo` no `package.json`): elas mudam a cada SDK.

## Telas e fluxo

**Início:** nome do motorista; contadores (pendentes, em andamento, concluídas hoje); lista de rotas agrupada por status; puxar para atualizar.

**Detalhe da rota:** nome, data, paradas em sequência com empresa, endereço, tipo de serviço, status e observação do admin. Ação principal fixa no rodapé conforme status:

| Status da rota | Ação principal |
|---|---|
| `ENVIADA` | "Confirmar recebimento" |
| `RECEBIDA` | "Iniciar rota" |
| `EM_ANDAMENTO` | "Próxima parada: <empresa>" |
| `CONCLUIDA` | resumo, sem ações |

**Execução da parada:**

| Status da parada | O que aparece |
|---|---|
| `PENDENTE` | "Ir para esta parada" (envia `SEGUIR_PARA` e oferece abrir o Waze) |
| `A_CAMINHO` | "Abrir no Waze", "Google Maps", "WhatsApp", "Cheguei ao local", "Registrar ocorrência" |
| `NO_LOCAL` | um botão por serviço pendente: "Coleta realizada" / "Entrega concluída"; "Não foi possível" (abre ocorrência obrigatória) |
| `FINALIZADA` | resultado de cada serviço e horário |

Concluir serviço pede confirmação curta (o toque é irreversível). Depois da última parada, a tela mostra "Rota concluída" com o resumo.

**Ocorrência:** lista de tipos (`delivery-domain-rules`) em botões grandes; descrição só obrigatória em "Outro"; sem digitação desnecessária.

## Conectividade limitada

- TanStack Query com `onlineManager` ligado ao `@react-native-community/netinfo` e `focusManager` ligado ao `AppState` (ao voltar do Waze, a tela recarrega).
- Cache das rotas do dia persistido em AsyncStorage (dados operacionais, sem tokens) para abrir a rota sem rede.
- Fila de comandos persistida: `{ chave, metodo, caminho, corpo, ocorridoEm, tentativas }`, enviada em ordem quando a rede volta, com backoff (1 s, 2 s, 5 s, 15 s, 30 s).
- Respostas: `2xx` → remove da fila e recarrega a rota; `409 TRANSICAO_INVALIDA` → remove, mostra a mensagem da API ("Esta parada foi cancelada pela administração") e recarrega; `401` → tenta refresh uma vez, senão login (fila preservada até o login do **mesmo** usuário); `5xx`/timeout → mantém e tenta de novo.
- Banner discreto "Sem conexão — 2 ações aguardando envio" enquanto houver fila.
- Timeout de requisição de 15 s; nunca travar a tela esperando rede.

## Waze, Google Maps e WhatsApp

```ts
async function abrirExterno(url: string, alternativa?: string) {
  try {
    await Linking.openURL(url);
  } catch {
    if (alternativa) return Linking.openURL(alternativa);
    Alert.alert('Não foi possível abrir', 'Verifique se o aplicativo está instalado.');
  }
}
// abrirExterno(linkWaze(parada), linkGoogleMaps(parada));
```

Links `https://waze.com/ul?...` e `https://wa.me/...` abrem o app quando instalado e o navegador quando não, sem precisar declarar `<queries>` no manifesto. Parada sem coordenada usa o endereço textual (o construtor decide). Sem telefone, o botão de WhatsApp não aparece.

## Permissões e configuração Android

- MVP: `android.permissions: []` em `app.json` (só as permissões mínimas). Não deixe permissões que o app não usa — a Play Store exige justificativa para permissões sensíveis.
- `android.package` atual (`br.com.rotas.motorista`) é provisório: defina o definitivo antes do primeiro envio à Play Store, porque ele não pode ser trocado depois.
- **Etapa 2 — notificações:** `expo-notifications`, permissão `POST_NOTIFICATIONS` (Android 13+) pedida após o login com explicação; token do dispositivo registrado na API.
- **Etapa 2 — câmera/assinatura:** pedir câmera só ao abrir o comprovante; reencodar a imagem antes do envio (remove EXIF).
- **Etapa 2 — localização:** primeiro em primeiro plano durante `EM_ANDAMENTO`. Segundo plano (`expo-location` + `expo-task-manager`) só com aprovação, aviso em destaque antes do pedido do sistema, serviço em primeiro plano com notificação persistente e declaração no Play Console. Parar a coleta ao concluir/cancelar a rota ou no logout.

## UX de campo

- Alvos de toque ≥ 48 dp; botão principal em largura total, na parte inferior (uso com uma mão).
- Fonte base ≥ 16 sp e respeito ao tamanho de fonte do sistema; contraste alto para uso sob sol.
- Status sempre com texto, não só cor.
- Evitar teclado: escolhas por botão; quando houver campo de texto, botão de envio visível acima do teclado.
- Estado da tela preservado ao alternar para Waze/WhatsApp e voltar.

## Erros a evitar

- Guardar token em AsyncStorage.
- Gerar nova `Idempotency-Key` em cada tentativa de reenvio.
- Atualizar o status localmente como definitivo antes da resposta da API.
- `Linking.canOpenURL` com esquema `waze://` sem `<queries>` (retorna falso no Android 11+); use o link `https`.
- Pedir todas as permissões no primeiro uso.
- Biblioteca de estado global extra (Redux, MobX) quando TanStack Query + estado local resolvem.

## Critérios de conclusão

- [ ] Fluxo completo testado em emulador ou aparelho Android: login → confirmar → iniciar → cheguei → concluir serviço → rota concluída.
- [ ] Modo avião durante a execução: ação fica na fila, é reenviada ao voltar a rede e não duplica no servidor.
- [ ] Waze, Google Maps e WhatsApp abrem (ou mostram alerta) a partir de uma parada real de seed.
- [ ] `app.json` sem permissões não usadas.
- [ ] `pnpm exec expo export --platform android` gera o bundle sem erro (confirma resolução do Metro no monorepo).
- [ ] `pnpm --filter driver lint typecheck test` executados e passando (`testing-quality`).
- [ ] Informe no resumo se o teste foi em emulador, aparelho ou não foi possível executar.

## Exemplos

**Admin cancela a parada enquanto o motorista está sem sinal e toca "Cheguei":** o comando vai para a fila; ao reconectar, a API responde `409 TRANSICAO_INVALIDA`; o app remove o comando, mostra "Esta parada foi cancelada pela administração" e recarrega a rota.

**Motorista volta do Waze:** `AppState` volta para `active` → consultas da rota em foco são revalidadas → se o admin adicionou uma parada, ela aparece na lista.

## Integração com outras skills

- `delivery-domain-rules`: ações por status e tipos de ocorrência.
- `maps-route-planning`: `linkWaze`, `linkGoogleMaps`, `linkWhatsApp`.
- `auth-security-lgpd`: armazenamento de tokens, permissões e coleta de localização.
- `nestjs-backend`: idempotência e envelope de erro.
- `devops-documentation`: perfis EAS (`development`, `preview` APK, `production` AAB) e variáveis `EXPO_PUBLIC_*`.
- `testing-quality`: testes da fila de comandos e dos componentes.

---
name: maps-route-planning
description: Integra mapas, geocodificação e planejamento de percurso no sistema de rotas e entregas — localização das empresas, links de Waze, Google Maps e WhatsApp, ordenação manual das paradas, estimativa de distância e duração, sugestão de ordem e preparação para otimização futura, considerando custos, limites de API, falhas e endereços incompletos. Use ao mexer em coordenadas, mapa do painel, links externos, estimativas ou qualquer recurso chamado de "otimização".
---

# maps-route-planning

## Regras que valem sempre (leia primeiro)

1. **Nunca chame uma ordem de "otimizada"** se ela não veio de um algoritmo ou serviço de otimização de rotas de fato. Heurística simples se chama "sugestão por proximidade".
2. MVP: ordem **manual** (arrastar e soltar) + links de navegação. Otimização automática é Etapa 2 e entra por ADR.
3. Distância em linha reta (Haversine) só é exibida com esse nome. "Distância estimada da rota" e "tempo estimado" vêm de serviço de roteamento e mostram a fonte e o horário do cálculo.
4. Falha do provedor de mapas nunca impede salvar empresa, montar ou enviar rota. O dado fica marcado como ausente e a interface explica.
5. Chamadas ao provedor saem do servidor com chave própria; o cliente usa só a chave pública restrita para exibir o mapa (`auth-security-lgpd`).
6. Construtores de links (`linkWaze`, `linkGoogleMaps`, `linkWhatsApp`) existem só em `packages/shared/src/links.ts`.

## Objetivo e escopo

Responsável por: escolha e adaptador do provedor de mapas, geocodificação e ajuste manual de localização, links externos (navegação e WhatsApp), normalização de telefone para WhatsApp, estimativas de percurso, campo `ordemOrigem`, sugestão de ordem e o desenho da otimização futura.

Fora do escopo: regras de quais paradas podem ser reordenadas (`delivery-domain-rules`), componente visual de lista e tela de montagem (`admin-dashboard-ui`), rastreamento de posições do motorista e sua privacidade (`auth-security-lgpd` + Etapa 2).

## Quando usar

- Cadastrar/editar endereço de empresa ou ajustar pin no mapa.
- Criar ou alterar qualquer botão de Waze, Google Maps ou WhatsApp.
- Exibir mapa com paradas, calcular distância/duração, sugerir ou otimizar ordem.
- Avaliar custo ou limite de uso de um provedor de mapas.

## Provedor (decidir em ADR antes de implementar geocodificação)

| Opção | Pontos a verificar no ADR |
|---|---|
| Google Maps Platform (Geocoding, Routes, Maps JavaScript) | qualidade de endereços no Brasil; preço por chamada e cota gratuita atuais; termos sobre armazenamento de coordenadas geocodificadas |
| Mapbox | preço e cota atuais; cobertura de números de endereço nas cidades atendidas |
| Stack OpenStreetMap (Nominatim/OSRM/GraphHopper, próprios ou contratados) | servidores públicos têm política de uso restrita (não usar em produção); custo de hospedar |

O ADR registra: provedor, APIs usadas, estimativa de volume mensal (empresas novas/mês, rotas/dia × paradas), custo estimado, cotas e alertas de orçamento configurados, e o que os termos permitem guardar.

### Adaptador

```ts
// apps/api/src/modulos/mapas/provedor-mapas.ts
export interface ProvedorMapas {
  geocodificar(endereco: EnderecoEmpresa): Promise<ResultadoGeocodificacao | null>;
  estimarPercurso(pontos: Coordenada[]): Promise<EstimativaPercurso | null>;
}
```

Uma implementação real + uma falsa para testes. Timeout de 5 s, uma nova tentativa em erro de rede, nenhuma tentativa em erro 4xx. Não crie "fábrica de provedores" para vários fornecedores antes de existir o segundo.

## Localização das empresas

- Ao salvar empresa com endereço novo ou alterado, a API tenta geocodificar **depois** de gravar o cadastro (fora da transação).
- Grava `latitude`, `longitude`, `fonteLocalizacao` (`GEOCODIFICADA` | `MANUAL`), `precisaoLocalizacao` (exata/aproximada, conforme o provedor informar) e `localizacaoAtualizadaEm`.
- Pin ajustado pelo admin vira `MANUAL` e não é sobrescrito por nova geocodificação, a menos que o endereço mude **e** o admin confirme.
- Resultado aproximado (só rua, bairro ou cidade) é salvo como aproximado e o painel pede conferência no mapa.
- Sem resultado: empresa salva sem coordenada; lista de empresas permite filtrar "sem localização".
- Respeite os termos do provedor sobre por quanto tempo coordenadas geocodificadas podem ser armazenadas; se houver limite, registre rotina de renovação no ADR.

## Links externos

```ts
// packages/shared/src/links.ts
type Destino = { latitude?: number | null; longitude?: number | null; enderecoFormatado: string };

export function linkWaze(d: Destino): string {
  if (d.latitude != null && d.longitude != null)
    return `https://waze.com/ul?ll=${d.latitude},${d.longitude}&navigate=yes`;
  return `https://waze.com/ul?q=${encodeURIComponent(d.enderecoFormatado)}&navigate=yes`;
}

export function linkGoogleMaps(d: Destino): string {
  const destino = d.latitude != null && d.longitude != null
    ? `${d.latitude},${d.longitude}` : d.enderecoFormatado;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}&travelmode=driving`;
}

export function linkWhatsApp(telefoneE164: string, mensagem?: string): string {
  const digitos = telefoneE164.replace(/\D/g, '');
  return `https://wa.me/${digitos}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`;
}
```

- Coordenadas com até 6 casas decimais.
- `enderecoFormatado` = "Logradouro, número – Bairro, Cidade – UF, CEP" (sem complemento, que atrapalha a busca).
- `normalizarTelefoneBR(entrada)`: remove não dígitos; aceita 10–11 dígitos (DDD + número) e prefixa `55`; aceita 12–13 dígitos começando com `55`; caso contrário, inválido. Grava `+55...`.
- Mensagem padrão opcional do WhatsApp sem dados pessoais além do nome da empresa (ex.: "Olá, aqui é o motorista da rota de hoje.").

## Mapa no painel e no app

- Painel: um componente `<MapaParadas paradas={...} />` com marcadores numerados na ordem atual; usa o SDK do provedor escolhido. Respeite a política de uso de tiles (servidores públicos de tiles do OSM não servem para produção).
- App do motorista: **sem mapa embutido no MVP**; a navegação é delegada ao Waze/Google Maps. Isso evita custo de SDK e permissões.

## Estimativa de percurso

- Calculada na API quando o admin pede "Calcular estimativa" e automaticamente ao enviar a rota — nunca a cada arrasto.
- Pontos: ponto de partida configurado (base/depósito, se existir) + paradas com coordenada, na ordem atual.
- Grava na rota: `distanciaEstimadaM`, `duracaoEstimadaS`, `fonteEstimativa`, `estimativaCalculadaEm`. Edição posterior da ordem marca a estimativa como desatualizada (comparando com a última edição).
- "Considera trânsito" só aparece se a chamada pediu duração com trânsito ao provedor.
- Paradas sem coordenada ficam fora do cálculo e a tela avisa: "2 paradas sem localização não entraram na estimativa."
- Limite de uso por admin nos endpoints que chamam o provedor (ex.: 30/min) e alerta de orçamento no console do provedor.

## Ordem das paradas

Campo `Rota.ordemOrigem`: `MANUAL` | `SUGESTAO_PROXIMIDADE` | `OTIMIZADA_PROVEDOR`.

- **MANUAL (MVP):** ordem definida pelo admin.
- **SUGESTAO_PROXIMIDADE (opcional):** vizinho mais próximo em linha reta a partir do ponto de partida. Rótulo obrigatório: "Sugestão por proximidade (linha reta). Revise antes de enviar." Função pura em `packages/shared` ou no módulo `mapas`, com testes.
- **OTIMIZADA_PROVEDOR (Etapa 2):** só via serviço de otimização (otimização de waypoints do provedor ou solver como VROOM/OR-Tools) com ADR. Antes de implementar, confirme no ADR: limite de paradas por chamada, suporte a janelas de horário (horário de funcionamento), custo por chamada, comportamento quando falha. Qualquer reordenação vira sugestão que o admin aceita; nunca reordena uma rota enviada sem ação do admin.

## Erros a evitar

- Escrever um solver próprio (TSP/VRP, algoritmo genético) no MVP.
- Mostrar Haversine como "distância da rota".
- Recalcular estimativa a cada render ou arrasto.
- Bloquear o cadastro porque a geocodificação falhou.
- Chave de servidor no painel ou no app.
- Gerar links montando strings diferentes em cada tela.
- Usar `waze://` como link principal (exige configuração de visibilidade de pacotes no Android 11+).

## Critérios de conclusão

- [ ] Links gerados só pelos construtores de `packages/shared`, com testes cobrindo: com coordenada, sem coordenada, caracteres especiais (acentos, `#`, `/`), telefone em vários formatos.
- [ ] Falha simulada do provedor (timeout, 500, sem resultado) não quebra cadastro nem envio; interface mostra o estado.
- [ ] Estimativas exibem fonte e horário; linha reta rotulada como tal.
- [ ] Nada chamado de "otimizado" sem `ordemOrigem = OTIMIZADA_PROVEDOR`.
- [ ] ADR do provedor existe antes da primeira chamada paga.

## Exemplos

**Empresa com CEP errado:** geocodificação retorna só a cidade → salva como aproximada; painel mostra "Localização aproximada — confira no mapa"; admin arrasta o pin → `MANUAL`.

**Admin pede "otimize a rota de hoje" no MVP:** responder que a otimização automática é da Etapa 2; oferecer reordenação manual no mapa e, se aprovada, a sugestão por proximidade com o rótulo correto.

## Integração com outras skills

- `admin-dashboard-ui` e `react-native-driver-app` consomem os links e o componente de mapa.
- `delivery-domain-rules` diz quais paradas podem ser reordenadas em cada status.
- `postgres-prisma-data` cria as colunas de localização e estimativa.
- `auth-security-lgpd` restringe as chaves e trata localização do motorista (rastreamento).
- `testing-quality` cobre construtores, normalização e falhas do provedor.

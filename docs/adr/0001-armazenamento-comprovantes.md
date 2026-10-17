# 0001 — Armazenamento das fotos de comprovante

- Status: aceito para desenvolvimento e testes; armazenamento de produção proposto (depende de aprovação antes da publicação)
- Data: 2026-10-17

## Contexto

O motorista registra o comprovante de entrega: foto, assinatura e/ou nome de quem recebeu. São dados
pessoais do recebedor (auth-security-lgpd): acesso só do admin, nunca em log, leitura por link assinado
de curta duração. A foto pesa de 100 a 300 KB depois de reduzida no app; a assinatura são poucos KB de
traços. O app precisa registrar a entrega sem sinal, e o comando entra na fila offline.

O sistema ainda não foi publicado e não há conta em provedor de armazenamento. No Render, o disco da
API é apagado a cada deploy.

## Decisão

- **Interface única `ArmazenamentoArquivos`** (`apps/api/src/modulos/armazenamento/`): `salvar`, `apagar`
  e `urlLeitura` (link assinado). O resto da API só conhece o token `ARMAZENAMENTO`.
- **Agora (dev e testes): disco** (`ArmazenamentoEmDisco`, pasta `ARMAZENAMENTO_PASTA`). A própria API
  serve a foto em `GET /api/v1/arquivos/comprovantes/<rotaId>/<uuid>.jpg?expira=…&assinatura=…`, com HMAC
  derivado do segredo do JWT, validade de 5 minutos e resposta 404 para link vencido ou adulterado.
- **Envio pela API, no mesmo comando**: a foto vai em base64 junto com "serviço realizado"
  (`comprovante.fotoJpegBase64`, JPEG, até 1,5 MB). Assim o comando continua único e idempotente e funciona
  na fila offline. A API grava o arquivo antes da transação (sem E/S externa dentro dela) e apaga se o
  comando não o usar (repetição, recusa ou erro).
- **Assinatura e nome no banco** (`comprovantes.assinatura` em JSON, `nome_recebedor`): são pequenos e
  não precisam de link.
- **Foto reencodada no app** (redução para 1280 px e JPEG 60%): remove EXIF, inclusive o GPS do arquivo.

## Alternativas consideradas

- **Foto no Postgres (bytea)**: simples, mas faz o banco crescer rápido (Neon gratuito tem 0,5 GB) e pesa
  nos backups. Descartada.
- **URL de upload assinada direto para o bucket** (como sugere auth-security-lgpd): tira o tráfego da API,
  mas divide o comando em três passos (pedir URL, enviar, confirmar), o que complica a fila offline e
  a idempotência. Pode ser revista se o volume de fotos pesar na API.
- **MinIO no docker compose desde já**: aproxima o dev da produção, mas acrescenta serviço de
  infraestrutura sem uso real ainda. Fica para quando o driver S3 for escrito.

## Consequências

- **Antes de publicar** é obrigatório trocar o disco por um bucket privado compatível com S3 (sugestão:
  Cloudflare R2, sem custo de saída) implementando `ArmazenamentoArquivos` com links pré-assinados de 5
  minutos. Isso exige criar a conta e aprovar o provedor; registrar em novo ADR.
- O corpo JSON da API aceita até 3 MB (por causa da foto em base64).
- A fila offline do app guarda a foto até o envio (AsyncStorage): muitas entregas sem sinal ocupam mais
  espaço no aparelho.
- Retenção: as fotos ficam enquanto a rota existir; definir prazo de guarda (contrato/LGPD) antes de
  produção.

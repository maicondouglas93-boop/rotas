-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('ADMIN', 'MOTORISTA');

-- CreateEnum
CREATE TYPE "StatusRota" AS ENUM ('RASCUNHO', 'ENVIADA', 'RECEBIDA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusParada" AS ENUM ('PENDENTE', 'A_CAMINHO', 'NO_LOCAL', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoServico" AS ENUM ('COLETA', 'ENTREGA');

-- CreateEnum
CREATE TYPE "StatusServico" AS ENUM ('PENDENTE', 'REALIZADO', 'NAO_REALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "OrdemOrigem" AS ENUM ('MANUAL', 'SUGESTAO_PROXIMIDADE', 'OTIMIZADA_PROVEDOR');

-- CreateEnum
CREATE TYPE "FonteLocalizacao" AS ENUM ('GEOCODIFICADA', 'MANUAL');

-- CreateEnum
CREATE TYPE "PrecisaoLocalizacao" AS ENUM ('EXATA', 'APROXIMADA');

-- CreateEnum
CREATE TYPE "TipoOcorrencia" AS ENUM ('ENDERECO_INCORRETO', 'EMPRESA_FECHADA', 'CLIENTE_AUSENTE', 'RECUSA_RECEBIMENTO', 'MERCADORIA_INDISPONIVEL', 'ENTREGA_NAO_REALIZADA', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoEventoRota" AS ENUM ('ROTA_CRIADA', 'ROTA_EDITADA', 'ROTA_ENVIADA', 'ROTA_RECEBIDA', 'ROTA_INICIADA', 'ROTA_CONCLUIDA', 'ROTA_CANCELADA', 'ROTA_TRANSFERIDA', 'PARADA_A_CAMINHO', 'PARADA_RETORNOU_FILA', 'PARADA_CHEGADA', 'PARADA_FINALIZADA', 'PARADA_CANCELADA', 'SERVICO_REALIZADO', 'SERVICO_NAO_REALIZADO', 'OCORRENCIA_REGISTRADA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deve_trocar_senha" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_refresh" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "familia_id" UUID NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "revogada_em" TIMESTAMPTZ(3),
    "substituida_por_id" UUID,
    "user_agent" TEXT,
    "ip" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_refresh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comandos_processados" (
    "usuario_id" UUID NOT NULL,
    "chave" UUID NOT NULL,
    "status_http" INTEGER NOT NULL,
    "corpo" JSONB NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comandos_processados_pkey" PRIMARY KEY ("usuario_id","chave")
);

-- CreateTable
CREATE TABLE "motoristas" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "desativado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "motoristas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" UUID NOT NULL,
    "nome_fantasia" TEXT NOT NULL,
    "razao_social" TEXT,
    "documento" TEXT,
    "telefone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "cep" CHAR(8) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "fonte_localizacao" "FonteLocalizacao",
    "precisao_localizacao" "PrecisaoLocalizacao",
    "localizacao_atualizada_em" TIMESTAMPTZ(3),
    "responsavel" TEXT,
    "horario_funcionamento" TEXT,
    "observacoes" TEXT,
    "arquivada_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "data_prevista" DATE NOT NULL,
    "status" "StatusRota" NOT NULL DEFAULT 'RASCUNHO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "motorista_id" UUID,
    "ordem_origem" "OrdemOrigem" NOT NULL DEFAULT 'MANUAL',
    "distancia_estimada_m" INTEGER,
    "duracao_estimada_s" INTEGER,
    "fonte_estimativa" TEXT,
    "estimativa_calculada_em" TIMESTAMPTZ(3),
    "enviada_em" TIMESTAMPTZ(3),
    "recebida_em" TIMESTAMPTZ(3),
    "iniciada_em" TIMESTAMPTZ(3),
    "concluida_em" TIMESTAMPTZ(3),
    "cancelada_em" TIMESTAMPTZ(3),
    "motivo_cancelamento" TEXT,
    "criado_por_id" UUID NOT NULL,
    "rota_origem_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paradas" (
    "id" UUID NOT NULL,
    "rota_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "status" "StatusParada" NOT NULL DEFAULT 'PENDENTE',
    "nome_empresa" TEXT NOT NULL,
    "endereco_formatado" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "observacoes" TEXT,
    "chegada_em" TIMESTAMPTZ(3),
    "finalizada_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "paradas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicos" (
    "id" UUID NOT NULL,
    "parada_id" UUID NOT NULL,
    "tipo" "TipoServico" NOT NULL,
    "status" "StatusServico" NOT NULL DEFAULT 'PENDENTE',
    "executado_por_motorista_id" UUID,
    "concluido_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "servicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocorrencias" (
    "id" UUID NOT NULL,
    "parada_id" UUID NOT NULL,
    "servico_id" UUID,
    "motorista_id" UUID NOT NULL,
    "tipo" "TipoOcorrencia" NOT NULL,
    "descricao" TEXT,
    "ocorrencia_anterior_id" UUID,
    "ocorrida_em" TIMESTAMPTZ(3) NOT NULL,
    "registrada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocorrencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rota_eventos" (
    "id" UUID NOT NULL,
    "rota_id" UUID NOT NULL,
    "tipo" "TipoEventoRota" NOT NULL,
    "status_anterior" TEXT,
    "status_novo" TEXT,
    "autor_usuario_id" UUID,
    "dados" JSONB NOT NULL DEFAULT '{}',
    "ocorrido_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rota_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_refresh_token_hash_key" ON "sessoes_refresh"("token_hash");

-- CreateIndex
CREATE INDEX "sessoes_refresh_usuario_id_idx" ON "sessoes_refresh"("usuario_id");

-- CreateIndex
CREATE INDEX "sessoes_refresh_familia_id_idx" ON "sessoes_refresh"("familia_id");

-- CreateIndex
CREATE INDEX "comandos_processados_criado_em_idx" ON "comandos_processados"("criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "motoristas_usuario_id_key" ON "motoristas"("usuario_id");

-- CreateIndex
CREATE INDEX "rotas_motorista_id_status_idx" ON "rotas"("motorista_id", "status");

-- CreateIndex
CREATE INDEX "rotas_data_prevista_idx" ON "rotas"("data_prevista");

-- CreateIndex
CREATE INDEX "rotas_status_data_prevista_idx" ON "rotas"("status", "data_prevista");

-- CreateIndex
CREATE INDEX "paradas_empresa_id_idx" ON "paradas"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "paradas_rota_id_sequencia_key" ON "paradas"("rota_id", "sequencia");

-- CreateIndex
CREATE INDEX "servicos_executado_por_motorista_id_concluido_em_idx" ON "servicos"("executado_por_motorista_id", "concluido_em");

-- CreateIndex
CREATE UNIQUE INDEX "servicos_parada_id_tipo_key" ON "servicos"("parada_id", "tipo");

-- CreateIndex
CREATE INDEX "ocorrencias_parada_id_idx" ON "ocorrencias"("parada_id");

-- CreateIndex
CREATE INDEX "ocorrencias_motorista_id_ocorrida_em_idx" ON "ocorrencias"("motorista_id", "ocorrida_em");

-- CreateIndex
CREATE INDEX "rota_eventos_rota_id_criado_em_idx" ON "rota_eventos"("rota_id", "criado_em");

-- AddForeignKey
ALTER TABLE "sessoes_refresh" ADD CONSTRAINT "sessoes_refresh_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comandos_processados" ADD CONSTRAINT "comandos_processados_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motoristas" ADD CONSTRAINT "motoristas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_rota_origem_id_fkey" FOREIGN KEY ("rota_origem_id") REFERENCES "rotas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paradas" ADD CONSTRAINT "paradas_rota_id_fkey" FOREIGN KEY ("rota_id") REFERENCES "rotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paradas" ADD CONSTRAINT "paradas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicos" ADD CONSTRAINT "servicos_parada_id_fkey" FOREIGN KEY ("parada_id") REFERENCES "paradas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicos" ADD CONSTRAINT "servicos_executado_por_motorista_id_fkey" FOREIGN KEY ("executado_por_motorista_id") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencias" ADD CONSTRAINT "ocorrencias_parada_id_fkey" FOREIGN KEY ("parada_id") REFERENCES "paradas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencias" ADD CONSTRAINT "ocorrencias_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencias" ADD CONSTRAINT "ocorrencias_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencias" ADD CONSTRAINT "ocorrencias_ocorrencia_anterior_id_fkey" FOREIGN KEY ("ocorrencia_anterior_id") REFERENCES "ocorrencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rota_eventos" ADD CONSTRAINT "rota_eventos_rota_id_fkey" FOREIGN KEY ("rota_id") REFERENCES "rotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rota_eventos" ADD CONSTRAINT "rota_eventos_autor_usuario_id_fkey" FOREIGN KEY ("autor_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- Restrições que o Prisma não expressa (postgres-prisma-data) ----------

-- E-mail sempre em minúsculas (unicidade não depende de maiúsculas).
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_email_minusculo" CHECK ("email" = lower("email"));

-- Documento (CPF/CNPJ só dígitos) único entre empresas não arquivadas.
CREATE UNIQUE INDEX "empresas_documento_ativo_uq"
  ON "empresas" ("documento")
  WHERE "documento" IS NOT NULL AND "arquivada_em" IS NULL;
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_documento_digitos"
  CHECK ("documento" IS NULL OR "documento" ~ '^([0-9]{11}|[0-9]{14})$');
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_cep_digitos" CHECK ("cep" ~ '^[0-9]{8}$');
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_uf_maiuscula" CHECK ("uf" ~ '^[A-Z]{2}$');
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_latitude_valida"
  CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90);
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_longitude_valida"
  CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180);
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_coordenadas_juntas"
  CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

-- Busca de empresas por nome sem diferenciar maiúsculas.
CREATE INDEX "empresas_nome_fantasia_lower_idx" ON "empresas" (lower("nome_fantasia"));

ALTER TABLE "paradas" ADD CONSTRAINT "paradas_sequencia_positiva" CHECK ("sequencia" > 0);
ALTER TABLE "paradas" ADD CONSTRAINT "paradas_coordenadas_juntas"
  CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

ALTER TABLE "rotas" ADD CONSTRAINT "rotas_versao_positiva" CHECK ("versao" > 0);
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_estimativas_nao_negativas"
  CHECK (("distancia_estimada_m" IS NULL OR "distancia_estimada_m" >= 0)
     AND ("duracao_estimada_s" IS NULL OR "duracao_estimada_s" >= 0));
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_enviada_tem_motorista"
  CHECK ("status" = 'RASCUNHO' OR "motorista_id" IS NOT NULL);
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_cancelada_tem_motivo"
  CHECK ("status" <> 'CANCELADA' OR "motivo_cancelamento" IS NOT NULL);

-- Ocorrência "OUTRO" exige descrição.
ALTER TABLE "ocorrencias" ADD CONSTRAINT "ocorrencias_outro_tem_descricao"
  CHECK ("tipo" <> 'OUTRO' OR char_length(coalesce("descricao", '')) >= 10);

-- CreateTable
CREATE TABLE "comprovantes" (
    "id" UUID NOT NULL,
    "servico_id" UUID NOT NULL,
    "motorista_id" UUID NOT NULL,
    "nome_recebedor" TEXT,
    "assinatura" JSONB,
    "foto_chave" TEXT,
    "foto_bytes" INTEGER,
    "registrado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprovantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comprovantes_servico_id_key" ON "comprovantes"("servico_id");

-- CreateIndex
CREATE INDEX "comprovantes_motorista_id_registrado_em_idx" ON "comprovantes"("motorista_id", "registrado_em");

-- AddForeignKey
ALTER TABLE "comprovantes" ADD CONSTRAINT "comprovantes_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprovantes" ADD CONSTRAINT "comprovantes_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

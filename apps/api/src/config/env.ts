import { z } from 'zod';

// Toda variável nova entra aqui, no .env.example e em docs/ambiente.md (devops-documentation).
const esquemaEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  CORS_ORIGENS: z
    .string()
    .default('http://localhost:3000')
    .transform((valor) =>
      valor
        .split(',')
        .map((origem) => origem.trim())
        .filter(Boolean),
    ),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'log', 'debug', 'verbose']).default('log'),
});

export type Env = z.infer<typeof esquemaEnv>;

export const ENV = Symbol('ENV');

/** Valida as variáveis de ambiente. A mensagem cita só os nomes, nunca os valores. */
export function carregarEnv(fonte: NodeJS.ProcessEnv = process.env): Env {
  const resultado = esquemaEnv.safeParse(fonte);
  if (!resultado.success) {
    const campos = [...new Set(resultado.error.issues.map((i) => i.path.join('.')))].join(', ');
    throw new Error(`Variáveis de ambiente ausentes ou inválidas: ${campos}`);
  }
  return resultado.data;
}

/** Carrega o arquivo .env do diretório atual, se existir. Não sobrescreve variáveis já definidas. */
export function carregarArquivoEnv(caminho = '.env'): void {
  try {
    process.loadEnvFile(caminho);
  } catch {
    // Sem arquivo: usa as variáveis do ambiente (CI, Render).
  }
}

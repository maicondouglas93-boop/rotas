'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { emailSchema } from '@rotas/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { MolduraPublica } from '@/components/comum/moldura-publica';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { mensagemDeErro } from '@/lib/erros';
import { useSessao } from '@/lib/sessao';

const formularioSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, { message: 'Informe a senha.' }),
});
type Formulario = z.infer<typeof formularioSchema>;

/** Só aceita voltar para caminhos internos do painel (evita redirecionamento aberto). */
function destinoSeguro(volta: string | null): string {
  return volta && volta.startsWith('/') && !volta.startsWith('//') ? volta : '/rotas';
}

function FormularioLogin() {
  const { estado, entrar } = useSessao();
  const router = useRouter();
  const volta = destinoSeguro(useSearchParams().get('volta'));
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const form = useForm<Formulario>({ resolver: zodResolver(formularioSchema), defaultValues: { email: '', senha: '' } });

  useEffect(() => {
    if (estado.situacao === 'autenticado') {
      router.replace(estado.usuario.deveTrocarSenha ? '/trocar-senha' : volta);
    }
  }, [estado, router, volta]);

  async function enviar(dados: Formulario) {
    setErroGeral(null);
    try {
      await entrar(dados.email, dados.senha);
    } catch (erro) {
      setErroGeral(mensagemDeErro(erro));
      form.setValue('senha', '');
    }
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-5">
      <FieldGroup>
        <Field data-invalid={!!form.formState.errors.email}>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input id="email" type="email" autoComplete="username" autoFocus {...form.register('email')} />
          <FieldError errors={[form.formState.errors.email]} />
        </Field>
        <Field data-invalid={!!form.formState.errors.senha}>
          <FieldLabel htmlFor="senha">Senha</FieldLabel>
          <Input id="senha" type="password" autoComplete="current-password" {...form.register('senha')} />
          <FieldError errors={[form.formState.errors.senha]} />
        </Field>
      </FieldGroup>
      {erroGeral ? (
        <p role="alert" className="text-sm text-destructive">
          {erroGeral}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}

export default function PaginaLogin() {
  return (
    <MolduraPublica titulo="Entrar no painel" descricao="Use a sua conta de administrador.">
      <Suspense>
        <FormularioLogin />
      </Suspense>
    </MolduraPublica>
  );
}

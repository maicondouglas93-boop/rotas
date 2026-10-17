'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { json, requisitar } from '@/lib/api';
import { aplicarErrosDaApi, mensagemDeErro } from '@/lib/erros';
import { useSessao } from '@/lib/sessao';

const formularioSchema = z
  .object({
    senhaAtual: z.string().min(1, { message: 'Informe a senha atual.' }),
    novaSenha: z
      .string()
      .min(8, { message: 'A nova senha precisa de ao menos 8 caracteres.' })
      .max(128, { message: 'Use no máximo 128 caracteres.' }),
    confirmacao: z.string(),
  })
  .refine((d) => d.novaSenha === d.confirmacao, { message: 'As senhas não conferem.', path: ['confirmacao'] });
type Formulario = z.infer<typeof formularioSchema>;

export default function PaginaTrocarSenha() {
  const { estado, recarregarUsuario, sair } = useSessao();
  const router = useRouter();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const form = useForm<Formulario>({
    resolver: zodResolver(formularioSchema),
    defaultValues: { senhaAtual: '', novaSenha: '', confirmacao: '' },
  });

  useEffect(() => {
    if (estado.situacao === 'anonimo') router.replace('/login');
  }, [estado, router]);

  async function enviar(dados: Formulario) {
    setErroGeral(null);
    try {
      await requisitar('/auth/trocar-senha', {
        method: 'POST',
        body: json({ senhaAtual: dados.senhaAtual, novaSenha: dados.novaSenha }),
      });
      await recarregarUsuario();
      toast.success('Senha alterada.');
      router.replace('/rotas');
    } catch (erro) {
      if (!aplicarErrosDaApi(erro, (caminho, msg) => form.setError(caminho as keyof Formulario, msg))) {
        setErroGeral(mensagemDeErro(erro));
      }
    }
  }

  const obrigatoria = estado.situacao === 'autenticado' && estado.usuario.deveTrocarSenha;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border bg-background p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Trocar senha</h1>
          <p className="text-sm text-muted-foreground">
            {obrigatoria ? 'Por segurança, defina uma senha nova antes de continuar.' : 'Defina uma senha nova.'}
          </p>
        </div>
        <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-5">
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.senhaAtual}>
              <FieldLabel htmlFor="senhaAtual">Senha atual</FieldLabel>
              <Input id="senhaAtual" type="password" autoComplete="current-password" {...form.register('senhaAtual')} />
              <FieldError errors={[form.formState.errors.senhaAtual]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.novaSenha}>
              <FieldLabel htmlFor="novaSenha">Nova senha</FieldLabel>
              <Input id="novaSenha" type="password" autoComplete="new-password" {...form.register('novaSenha')} />
              <FieldDescription>Mínimo de 8 caracteres. Evite senhas comuns e o seu e-mail.</FieldDescription>
              <FieldError errors={[form.formState.errors.novaSenha]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.confirmacao}>
              <FieldLabel htmlFor="confirmacao">Repita a nova senha</FieldLabel>
              <Input id="confirmacao" type="password" autoComplete="new-password" {...form.register('confirmacao')} />
              <FieldError errors={[form.formState.errors.confirmacao]} />
            </Field>
          </FieldGroup>
          {erroGeral ? (
            <p role="alert" className="text-sm text-destructive">
              {erroGeral}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => sair()}>
              Sair
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

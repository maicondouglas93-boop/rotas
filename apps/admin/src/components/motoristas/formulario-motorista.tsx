'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Motorista } from '@rotas/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { DadosMotorista } from '@/lib/consultas/motoristas';
import { aplicarErrosDaApi, mensagemDeErro } from '@/lib/erros';
import { formatarTelefone } from '@/lib/formatos';

const formularioSchema = z.object({
  nome: z.string().trim().min(2, { message: 'Informe o nome (mínimo 2 caracteres).' }),
  email: z.string().trim().min(1, { message: 'Informe o e-mail.' }),
  telefone: z.string().trim().min(1, { message: 'Informe o telefone.' }),
});
type Formulario = z.infer<typeof formularioSchema>;

export function FormularioMotorista({
  motorista,
  rotuloEnviar,
  onEnviar,
  desabilitado = false,
}: {
  motorista?: Motorista;
  rotuloEnviar: string;
  onEnviar: (dados: DadosMotorista) => Promise<void>;
  desabilitado?: boolean;
}) {
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const form = useForm<Formulario>({
    resolver: zodResolver(formularioSchema),
    defaultValues: {
      nome: motorista?.nome ?? '',
      email: motorista?.email ?? '',
      telefone: motorista ? formatarTelefone(motorista.telefone) : '',
    },
  });
  const erros = form.formState.errors;

  async function enviar(valores: Formulario) {
    setErroGeral(null);
    const alterados = form.formState.dirtyFields;
    const dados: DadosMotorista = motorista
      ? Object.fromEntries(Object.entries(valores).filter(([campo]) => alterados[campo as keyof Formulario]))
      : valores;
    if (Object.keys(dados).length === 0) {
      setErroGeral('Nada foi alterado.');
      return;
    }
    try {
      await onEnviar(dados);
      form.reset(valores);
    } catch (erro) {
      if (!aplicarErrosDaApi(erro, (caminho, msg) => form.setError(caminho as keyof Formulario, msg))) {
        setErroGeral(mensagemDeErro(erro));
      }
    }
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-6">
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!erros.nome} className="sm:col-span-2">
          <FieldLabel htmlFor="nome">Nome</FieldLabel>
          <Input id="nome" autoComplete="off" disabled={desabilitado} {...form.register('nome')} />
          <FieldError errors={[erros.nome]} />
        </Field>
        <Field data-invalid={!!erros.email}>
          <FieldLabel htmlFor="email">E-mail de acesso</FieldLabel>
          <Input id="email" type="email" autoComplete="off" disabled={desabilitado} {...form.register('email')} />
          <FieldDescription>É o login do motorista no app.</FieldDescription>
          <FieldError errors={[erros.email]} />
        </Field>
        <Field data-invalid={!!erros.telefone}>
          <FieldLabel htmlFor="telefone">Telefone</FieldLabel>
          <Input id="telefone" type="tel" autoComplete="off" disabled={desabilitado} {...form.register('telefone')} />
          <FieldError errors={[erros.telefone]} />
        </Field>
      </FieldGroup>
      {erroGeral ? (
        <p role="alert" className="text-sm text-destructive">
          {erroGeral}
        </p>
      ) : null}
      {desabilitado ? null : (
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando…' : rotuloEnviar}
          </Button>
        </div>
      )}
    </form>
  );
}

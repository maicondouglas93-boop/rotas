'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Empresa } from '@rotas/shared';
import { useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { DadosEmpresa } from '@/lib/consultas/empresas';
import { aplicarErrosDaApi, mensagemDeErro } from '@/lib/erros';
import { formatarCep, formatarTelefone } from '@/lib/formatos';

const obrigatorio = (rotulo: string) => z.string().trim().min(1, { message: `Informe ${rotulo}.` });

/** Coordenadas coladas do Google Maps: "-23.5505, -46.6333". Vazio = sem localização. */
function lerCoordenadas(texto: string): { latitude: number; longitude: number } | null | 'invalido' {
  const limpo = texto.trim();
  if (!limpo) return null;
  const partes = limpo.split(/[,;\s]+/).filter(Boolean).map(Number);
  if (partes.length !== 2 || partes.some((n) => !Number.isFinite(n))) return 'invalido';
  const [latitude, longitude] = partes as [number, number];
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return 'invalido';
  return { latitude, longitude };
}

const formularioSchema = z.object({
  nomeFantasia: obrigatorio('o nome'),
  razaoSocial: z.string(),
  documento: z.string(),
  telefone: obrigatorio('o telefone'),
  whatsapp: z.string(),
  responsavel: z.string(),
  cep: obrigatorio('o CEP'),
  logradouro: obrigatorio('a rua'),
  numero: obrigatorio('o número'),
  complemento: z.string(),
  bairro: obrigatorio('o bairro'),
  cidade: obrigatorio('a cidade'),
  uf: obrigatorio('a UF'),
  coordenadas: z.string().refine((v) => lerCoordenadas(v) !== 'invalido', {
    message: 'Use o formato “-23.5505, -46.6333”.',
  }),
  horarioFuncionamento: z.string(),
  observacoes: z.string(),
});
export type FormularioEmpresa = z.infer<typeof formularioSchema>;
type Campo = keyof FormularioEmpresa;

function valoresIniciais(empresa?: Empresa): FormularioEmpresa {
  return {
    nomeFantasia: empresa?.nomeFantasia ?? '',
    razaoSocial: empresa?.razaoSocial ?? '',
    documento: '',
    telefone: empresa ? formatarTelefone(empresa.telefone) : '',
    whatsapp: empresa?.whatsapp ? formatarTelefone(empresa.whatsapp) : '',
    responsavel: empresa?.responsavel ?? '',
    cep: empresa ? formatarCep(empresa.cep) : '',
    logradouro: empresa?.logradouro ?? '',
    numero: empresa?.numero ?? '',
    complemento: empresa?.complemento ?? '',
    bairro: empresa?.bairro ?? '',
    cidade: empresa?.cidade ?? '',
    uf: empresa?.uf ?? '',
    coordenadas: empresa?.latitude != null && empresa.longitude != null ? `${empresa.latitude}, ${empresa.longitude}` : '',
    horarioFuncionamento: empresa?.horarioFuncionamento ?? '',
    observacoes: empresa?.observacoes ?? '',
  };
}

/**
 * Monta o corpo para a API. Na criação vai tudo (vazio = ausente); na edição só o que mudou
 * (vazio = apagar). Strings seguem como digitadas: a API normaliza telefone, CEP, UF e documento.
 */
function montarCorpo(valores: FormularioEmpresa, alterados: Partial<Record<Campo, unknown>> | null): DadosEmpresa {
  const corpo: DadosEmpresa = {};
  for (const campo of Object.keys(valores) as Campo[]) {
    if (campo === 'coordenadas' || (alterados && !alterados[campo])) continue;
    if (campo === 'documento' && !valores.documento.trim()) continue; // edição: vazio mantém o documento atual
    corpo[campo] = valores[campo];
  }
  if (!alterados || alterados.coordenadas) {
    const coordenadas = lerCoordenadas(valores.coordenadas);
    if (coordenadas && coordenadas !== 'invalido') Object.assign(corpo, coordenadas);
    else if (alterados) Object.assign(corpo, { latitude: null, longitude: null });
  }
  return corpo;
}

export function FormularioEmpresaCampos({
  empresa,
  rotuloEnviar,
  onEnviar,
  desabilitado = false,
}: {
  empresa?: Empresa;
  rotuloEnviar: string;
  onEnviar: (corpo: DadosEmpresa) => Promise<void>;
  desabilitado?: boolean;
}) {
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const form = useForm<FormularioEmpresa>({
    resolver: zodResolver(formularioSchema),
    defaultValues: valoresIniciais(empresa),
  });
  const erros: FieldErrors<FormularioEmpresa> = form.formState.errors;

  async function enviar(valores: FormularioEmpresa) {
    setErroGeral(null);
    const corpo = montarCorpo(valores, empresa ? form.formState.dirtyFields : null);
    if (empresa && Object.keys(corpo).length === 0) {
      setErroGeral('Nada foi alterado.');
      return;
    }
    try {
      await onEnviar(corpo);
      form.reset(valores);
    } catch (erro) {
      // Erros de latitude/longitude da API aparecem no campo único de coordenadas.
      const traduzido = aplicarErrosDaApi(erro, (caminho, mensagem) =>
        form.setError(caminho === 'latitude' || caminho === 'longitude' ? 'coordenadas' : (caminho as Campo), mensagem),
      );
      if (!traduzido) setErroGeral(mensagemDeErro(erro));
    }
  }

  const campo = (nome: Campo, rotulo: string, extras: { descricao?: string; tipo?: string; auto?: string } = {}) => (
    <Field data-invalid={!!erros[nome]}>
      <FieldLabel htmlFor={nome}>{rotulo}</FieldLabel>
      <Input id={nome} type={extras.tipo ?? 'text'} autoComplete={extras.auto ?? 'off'} disabled={desabilitado} {...form.register(nome)} />
      {extras.descricao ? <FieldDescription>{extras.descricao}</FieldDescription> : null}
      <FieldError errors={[erros[nome]]} />
    </Field>
  );

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-8">
      <FieldSet>
        <FieldLegend>Identificação</FieldLegend>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {campo('nomeFantasia', 'Nome fantasia')}
          {campo('razaoSocial', 'Razão social (opcional)')}
          {campo('documento', 'CNPJ ou CPF (opcional)', {
            descricao: empresa?.documentoMascarado
              ? `Atual: ${empresa.documentoMascarado}. Deixe vazio para manter.`
              : 'Só números ou com pontuação.',
          })}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Contato</FieldLegend>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {campo('telefone', 'Telefone', { tipo: 'tel' })}
          {campo('whatsapp', 'WhatsApp (opcional)', { tipo: 'tel', descricao: 'Usado no botão de conversa do app e do painel.' })}
          {campo('responsavel', 'Responsável (opcional)')}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Endereço e localização</FieldLegend>
        <FieldGroup className="grid gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2">{campo('cep', 'CEP')}</div>
          <div className="sm:col-span-4">{campo('logradouro', 'Rua / avenida')}</div>
          <div className="sm:col-span-2">{campo('numero', 'Número')}</div>
          <div className="sm:col-span-4">{campo('complemento', 'Complemento (opcional)')}</div>
          <div className="sm:col-span-3">{campo('bairro', 'Bairro')}</div>
          <div className="sm:col-span-2">{campo('cidade', 'Cidade')}</div>
          <div className="sm:col-span-1">{campo('uf', 'UF')}</div>
          <div className="sm:col-span-6">
            {campo('coordenadas', 'Localização no mapa (opcional)', {
              descricao:
                'Latitude e longitude, ex.: -23.5505, -46.6333. No Google Maps, clique com o botão direito no ponto para copiar.',
            })}
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Funcionamento e observações</FieldLegend>
        <FieldGroup>
          {campo('horarioFuncionamento', 'Horário de funcionamento (opcional)', { descricao: 'Ex.: seg. a sex., 8h às 18h' })}
          <Field data-invalid={!!erros.observacoes}>
            <FieldLabel htmlFor="observacoes">Observações (opcional)</FieldLabel>
            <Textarea id="observacoes" rows={3} disabled={desabilitado} {...form.register('observacoes')} />
            <FieldError errors={[erros.observacoes]} />
          </Field>
        </FieldGroup>
      </FieldSet>

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

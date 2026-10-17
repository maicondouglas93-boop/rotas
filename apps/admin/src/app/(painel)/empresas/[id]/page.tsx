'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { FormularioEmpresaCampos } from '@/components/empresas/formulario-empresa';
import { LinksExternos } from '@/components/comum/links-externos';
import { CabecalhoPagina, ConteudoPagina, ErroCarregamento, LinhasCarregando } from '@/components/comum/pagina';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { useArquivarEmpresa, useAtualizarEmpresa, useEmpresa, useReativarEmpresa } from '@/lib/consultas/empresas';
import { mensagemDeErro } from '@/lib/erros';
import { formatarDataHora } from '@/lib/formatos';

export default function PaginaEmpresa() {
  const { id } = useParams<{ id: string }>();
  const consulta = useEmpresa(id);
  const atualizar = useAtualizarEmpresa(id);
  const arquivar = useArquivarEmpresa();
  const reativar = useReativarEmpresa();
  const [confirmarArquivar, setConfirmarArquivar] = useState(false);

  if (consulta.isPending) {
    return (
      <ConteudoPagina estreita>
        <LinhasCarregando linhas={8} />
      </ConteudoPagina>
    );
  }
  if (consulta.isError) {
    return (
      <ConteudoPagina estreita>
        <ErroCarregamento erro={consulta.error} onTentarNovamente={() => consulta.refetch()} />
      </ConteudoPagina>
    );
  }

  const empresa = consulta.data;
  const arquivada = empresa.arquivadaEm !== null;

  async function executarReativar() {
    try {
      await reativar.mutateAsync(empresa.id);
      toast.success('Empresa reativada.');
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  }

  return (
    <ConteudoPagina estreita>
      <CabecalhoPagina
        titulo={empresa.nomeFantasia}
        descricao={
          arquivada
            ? `Arquivada em ${formatarDataHora(empresa.arquivadaEm)}. Não aparece na montagem de rotas.`
            : empresa.enderecoFormatado
        }
        acoes={
          <>
            <LinksExternos whatsapp={empresa.whatsapp} destino={empresa} />
            {arquivada ? (
              <Button variant="outline" onClick={executarReativar} disabled={reativar.isPending}>
                Reativar empresa
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setConfirmarArquivar(true)}>
                Arquivar
              </Button>
            )}
            <Link href="/empresas" className={buttonVariants({ variant: 'ghost' })}>
              Voltar
            </Link>
          </>
        }
      />

      <FormularioEmpresaCampos
        key={empresa.atualizadoEm}
        empresa={empresa}
        desabilitado={arquivada}
        rotuloEnviar="Salvar alterações"
        onEnviar={async (corpo) => {
          await atualizar.mutateAsync(corpo);
          toast.success('Alterações salvas.');
        }}
      />

      <AlertDialog open={confirmarArquivar} onOpenChange={setConfirmarArquivar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar {empresa.nomeFantasia}?</AlertDialogTitle>
            <AlertDialogDescription>
              A empresa deixa de aparecer na montagem de rotas. O histórico das rotas em que ela já esteve continua
              intacto, e você pode reativá-la depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={arquivar.isPending}
              onClick={async () => {
                try {
                  await arquivar.mutateAsync(empresa.id);
                  toast.success('Empresa arquivada.');
                  setConfirmarArquivar(false);
                } catch (erro) {
                  toast.error(mensagemDeErro(erro));
                }
              }}
            >
              Arquivar empresa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConteudoPagina>
  );
}

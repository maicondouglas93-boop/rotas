'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { CabecalhoPagina, ConteudoPagina, ErroCarregamento, LinhasCarregando } from '@/components/comum/pagina';
import { FormularioMotorista } from '@/components/motoristas/formulario-motorista';
import { SenhaTemporariaDialog } from '@/components/motoristas/senha-temporaria-dialog';
import { SituacaoMotorista } from '@/components/motoristas/situacao-motorista';
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
import {
  useAtualizarMotorista,
  useDesativarMotorista,
  useMotorista,
  useReativarMotorista,
  useRedefinirSenhaMotorista,
} from '@/lib/consultas/motoristas';
import { mensagemDeErro } from '@/lib/erros';
import { formatarDataHora } from '@/lib/formatos';

type Confirmacao = 'desativar' | 'redefinir' | null;

export default function PaginaMotorista() {
  const { id } = useParams<{ id: string }>();
  const consulta = useMotorista(id);
  const atualizar = useAtualizarMotorista(id);
  const desativar = useDesativarMotorista();
  const reativar = useReativarMotorista();
  const redefinir = useRedefinirSenhaMotorista();
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const [senhaNova, setSenhaNova] = useState<string | null>(null);

  if (consulta.isPending) {
    return (
      <ConteudoPagina estreita>
        <LinhasCarregando linhas={4} />
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

  const motorista = consulta.data;

  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    try {
      await acao();
      toast.success(sucesso);
      setConfirmacao(null);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    }
  }

  return (
    <ConteudoPagina estreita>
      <CabecalhoPagina
        titulo={
          <span className="flex items-center gap-2">
            {motorista.nome} <SituacaoMotorista motorista={motorista} />
          </span>
        }
        descricao={
          motorista.ativo
            ? `Cadastrado em ${formatarDataHora(motorista.criadoEm)}.`
            : `Desativado em ${formatarDataHora(motorista.desativadoEm)}. Sem acesso ao app.`
        }
        acoes={
          <>
            {motorista.ativo ? (
              <>
                <Button variant="outline" onClick={() => setConfirmacao('redefinir')}>
                  Redefinir senha
                </Button>
                <Button variant="outline" onClick={() => setConfirmacao('desativar')}>
                  Desativar
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                disabled={reativar.isPending}
                onClick={() => executar(() => reativar.mutateAsync(motorista.id), 'Motorista reativado.')}
              >
                Reativar motorista
              </Button>
            )}
            <Link href="/motoristas" className={buttonVariants({ variant: 'ghost' })}>
              Voltar
            </Link>
          </>
        }
      />

      <FormularioMotorista
        key={motorista.atualizadoEm}
        motorista={motorista}
        desabilitado={!motorista.ativo}
        rotuloEnviar="Salvar alterações"
        onEnviar={async (dados) => {
          await atualizar.mutateAsync(dados);
          toast.success('Alterações salvas.');
        }}
      />

      <AlertDialog open={confirmacao !== null} onOpenChange={(aberto) => !aberto && setConfirmacao(null)}>
        <AlertDialogContent>
          {confirmacao === 'desativar' ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Desativar {motorista.nome}?</AlertDialogTitle>
                <AlertDialogDescription>
                  O acesso ao app é cortado na hora, inclusive no celular que estiver aberto. Rotas que ainda estão com
                  ele continuam atribuídas: transfira ou cancele cada uma.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={desativar.isPending}
                  onClick={() => executar(() => desativar.mutateAsync(motorista.id), 'Motorista desativado.')}
                >
                  Desativar motorista
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Redefinir a senha de {motorista.nome}?</AlertDialogTitle>
                <AlertDialogDescription>
                  O sistema gera uma nova senha temporária, o motorista sai do app e precisa entrar com ela e trocá-la.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={redefinir.isPending}
                  onClick={async () => {
                    try {
                      const { senhaTemporaria } = await redefinir.mutateAsync(motorista.id);
                      setConfirmacao(null);
                      setSenhaNova(senhaTemporaria);
                    } catch (erro) {
                      toast.error(mensagemDeErro(erro));
                    }
                  }}
                >
                  Gerar nova senha
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <SenhaTemporariaDialog senha={senhaNova} nome={motorista.nome} onFechar={() => setSenhaNova(null)} />
    </ConteudoPagina>
  );
}

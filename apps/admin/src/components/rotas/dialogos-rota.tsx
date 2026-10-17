'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useMotoristas } from '@/lib/consultas/motoristas';
import { mensagemDeErro } from '@/lib/erros';

function DialogoBase({
  aberto,
  onFechar,
  titulo,
  descricao,
  children,
  rotuloConfirmar,
  destrutivo = false,
  podeConfirmar,
  onConfirmar,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  descricao: ReactNode;
  children?: ReactNode;
  rotuloConfirmar: string;
  destrutivo?: boolean;
  podeConfirmar: boolean;
  onConfirmar: () => Promise<void>;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setErro(null);
    setEnviando(true);
    try {
      await onConfirmar();
      onFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        {children}
        {erro ? (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Voltar
          </Button>
          <Button variant={destrutivo ? 'destructive' : 'default'} disabled={!podeConfirmar || enviando} onClick={confirmar}>
            {enviando ? 'Aguarde…' : rotuloConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampoMotivo({ valor, onMudar }: { valor: string; onMudar: (v: string) => void }) {
  const curto = valor.trim().length > 0 && valor.trim().length < 5;
  return (
    <Field data-invalid={curto}>
      <FieldLabel htmlFor="motivo">Motivo</FieldLabel>
      <Textarea id="motivo" rows={3} maxLength={500} value={valor} onChange={(e) => onMudar(e.target.value)} />
      {curto ? <FieldError>Descreva o motivo (mínimo 5 caracteres).</FieldError> : null}
    </Field>
  );
}

/** Confirmação simples (enviar, excluir). */
export function DialogoConfirmar(props: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  descricao: ReactNode;
  rotuloConfirmar: string;
  destrutivo?: boolean;
  onConfirmar: () => Promise<void>;
}) {
  return <DialogoBase {...props} podeConfirmar />;
}

/** Ação que exige motivo (cancelar rota, cancelar parada). */
export function DialogoMotivo({
  onConfirmar,
  ...props
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  descricao: ReactNode;
  rotuloConfirmar: string;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  return (
    <DialogoBase
      {...props}
      destrutivo
      podeConfirmar={motivo.trim().length >= 5}
      onConfirmar={() => onConfirmar(motivo.trim())}
      onFechar={() => {
        setMotivo('');
        props.onFechar();
      }}
    >
      <CampoMotivo valor={motivo} onMudar={setMotivo} />
    </DialogoBase>
  );
}

export function DialogoTransferir({
  aberto,
  onFechar,
  motoristaAtualId,
  onConfirmar,
}: {
  aberto: boolean;
  onFechar: () => void;
  motoristaAtualId: string | null;
  onConfirmar: (motoristaId: string, motivo: string) => Promise<void>;
}) {
  const [motoristaId, setMotoristaId] = useState('');
  const [motivo, setMotivo] = useState('');
  const motoristas = useMotoristas({ pagina: 1, porPagina: 100 });
  const opcoes = motoristas.data?.itens.filter((m) => m.id !== motoristaAtualId) ?? [];

  return (
    <DialogoBase
      aberto={aberto}
      onFechar={() => {
        setMotoristaId('');
        setMotivo('');
        onFechar();
      }}
      titulo="Transferir rota"
      descricao="A rota volta para “Enviada” com o novo motorista, que confirma e inicia. O que já foi feito continua registrado com quem fez."
      rotuloConfirmar="Transferir"
      podeConfirmar={motoristaId !== '' && motivo.trim().length >= 5}
      onConfirmar={() => onConfirmar(motoristaId, motivo.trim())}
    >
      <Field>
        <FieldLabel htmlFor="novo-motorista">Novo motorista</FieldLabel>
        <select
          id="novo-motorista"
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          value={motoristaId}
          onChange={(e) => setMotoristaId(e.target.value)}
        >
          <option value="">Escolha…</option>
          {opcoes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </Field>
      <CampoMotivo valor={motivo} onMudar={setMotivo} />
    </DialogoBase>
  );
}

export function DialogoDuplicar({
  aberto,
  onFechar,
  dataSugerida,
  onConfirmar,
}: {
  aberto: boolean;
  onFechar: () => void;
  dataSugerida: string;
  onConfirmar: (dataPrevista: string) => Promise<void>;
}) {
  const [data, setData] = useState(dataSugerida);
  return (
    <DialogoBase
      aberto={aberto}
      onFechar={onFechar}
      titulo="Duplicar rota"
      descricao="Cria um rascunho com as mesmas empresas, ordem e serviços, sem motorista. Empresas arquivadas ficam de fora."
      rotuloConfirmar="Duplicar"
      podeConfirmar={data !== ''}
      onConfirmar={() => onConfirmar(data)}
    >
      <Field>
        <FieldLabel htmlFor="data-copia">Data da nova rota</FieldLabel>
        <Input id="data-copia" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </Field>
    </DialogoBase>
  );
}

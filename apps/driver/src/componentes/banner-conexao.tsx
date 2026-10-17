import { useOnline } from '../api/conexao';
import { useFilaPendente } from '../api/consultas';
import { Aviso } from './basicos';

/** "Sem conexão — 2 ações aguardando envio". Some quando está tudo enviado. */
export function BannerConexao() {
  const online = useOnline();
  const pendentes = useFilaPendente().length;
  if (online && pendentes === 0) return null;
  const acoes = pendentes === 1 ? '1 ação aguardando envio' : `${pendentes} ações aguardando envio`;
  if (!online) return <Aviso texto={pendentes > 0 ? `Sem conexão — ${acoes}.` : 'Sem conexão. Mostrando os dados salvos.'} />;
  return <Aviso tom="info" texto={`Enviando: ${acoes}…`} />;
}

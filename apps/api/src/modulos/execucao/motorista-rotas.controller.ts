import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  comandoMotoristaSchema,
  filtroRotasMotoristaSchema,
  idParadaSchema,
  idRotaSchema,
  idServicoSchema,
  naoRealizarServicoSchema,
  registrarOcorrenciaSchema,
  type ComandoMotorista,
  type FiltroRotasMotorista,
  type NaoRealizarServicoEntrada,
  type RegistrarOcorrenciaEntrada,
  type RespostaPaginada,
  type Rota,
  type RotaResumo,
} from '@rotas/shared';
import { ChaveIdempotencia } from '../../comum/idempotencia/idempotencia.js';
import { ZodPipe } from '../../comum/pipes/zod.pipe.js';
import { Perfis, UsuarioAtual } from '../auth/decoradores.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { ExecucaoService } from './execucao.service.js';

const corpoComando = new ZodPipe(comandoMotoristaSchema);

// Rotas do próprio motorista. Todo POST exige o cabeçalho Idempotency-Key e devolve a rota atualizada.
@Controller('motorista')
@Perfis('MOTORISTA')
export class MotoristaRotasController {
  constructor(private readonly execucao: ExecucaoService) {}

  @Get('rotas')
  listar(
    @Query(new ZodPipe(filtroRotasMotoristaSchema)) filtro: FiltroRotasMotorista,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<RespostaPaginada<RotaResumo>> {
    return this.execucao.listar(usuario, filtro);
  }

  @Get('rotas/:id')
  buscar(@Param('id', new ZodPipe(idRotaSchema)) id: string, @UsuarioAtual() usuario: UsuarioAutenticado): Promise<Rota> {
    return this.execucao.buscar(usuario, id);
  }

  @Post('rotas/:id/confirmar-recebimento')
  @HttpCode(HttpStatus.OK)
  confirmarRecebimento(
    @Param('id', new ZodPipe(idRotaSchema)) id: string,
    @Body(corpoComando) dados: ComandoMotorista,
    @ChaveIdempotencia() chave: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.execucao.confirmarRecebimento(usuario, id, dados, chave);
  }

  @Post('rotas/:id/iniciar')
  @HttpCode(HttpStatus.OK)
  iniciar(
    @Param('id', new ZodPipe(idRotaSchema)) id: string,
    @Body(corpoComando) dados: ComandoMotorista,
    @ChaveIdempotencia() chave: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.execucao.iniciar(usuario, id, dados, chave);
  }

  @Post('paradas/:id/seguir')
  @HttpCode(HttpStatus.OK)
  seguir(
    @Param('id', new ZodPipe(idParadaSchema)) id: string,
    @Body(corpoComando) dados: ComandoMotorista,
    @ChaveIdempotencia() chave: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.execucao.seguirPara(usuario, id, dados, chave);
  }

  @Post('paradas/:id/voltar-para-fila')
  @HttpCode(HttpStatus.OK)
  voltarParaFila(
    @Param('id', new ZodPipe(idParadaSchema)) id: string,
    @Body(corpoComando) dados: ComandoMotorista,
    @ChaveIdempotencia() chave: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.execucao.voltarParaFila(usuario, id, dados, chave);
  }

  @Post('paradas/:id/cheguei')
  @HttpCode(HttpStatus.OK)
  cheguei(
    @Param('id', new ZodPipe(idParadaSchema)) id: string,
    @Body(corpoComando) dados: ComandoMotorista,
    @ChaveIdempotencia() chave: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.execucao.registrarChegada(usuario, id, dados, chave);
  }

  @Post('paradas/:id/ocorrencias')
  @HttpCode(HttpStatus.OK)
  registrarOcorrencia(
    @Param('id', new ZodPipe(idParadaSchema)) id: string,
    @Body(new ZodPipe(registrarOcorrenciaSchema)) dados: RegistrarOcorrenciaEntrada,
    @ChaveIdempotencia() chave: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.execucao.registrarOcorrencia(usuario, id, dados, chave);
  }

  @Post('servicos/:id/realizar')
  @HttpCode(HttpStatus.OK)
  realizar(
    @Param('id', new ZodPipe(idServicoSchema)) id: string,
    @Body(corpoComando) dados: ComandoMotorista,
    @ChaveIdempotencia() chave: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.execucao.realizarServico(usuario, id, dados, chave);
  }

  @Post('servicos/:id/nao-realizar')
  @HttpCode(HttpStatus.OK)
  naoRealizar(
    @Param('id', new ZodPipe(idServicoSchema)) id: string,
    @Body(new ZodPipe(naoRealizarServicoSchema)) dados: NaoRealizarServicoEntrada,
    @ChaveIdempotencia() chave: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.execucao.naoRealizarServico(usuario, id, dados, chave);
  }
}

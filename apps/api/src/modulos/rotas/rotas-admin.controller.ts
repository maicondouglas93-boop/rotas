import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import {
  cancelarSchema,
  comandoComVersaoSchema,
  criarRotaSchema,
  duplicarRotaSchema,
  editarRotaSchema,
  filtroRotasSchema,
  idParadaSchema,
  idRotaSchema,
  transferirRotaSchema,
  versaoQuerySchema,
  type CancelarEntrada,
  type ComandoComVersao,
  type CriarRotaEntrada,
  type DuplicarRotaEntrada,
  type EditarRotaEntrada,
  type EventoRota,
  type FiltroRotas,
  type OcorrenciaRota,
  type RespostaPaginada,
  type Rota,
  type RotaDuplicada,
  type RotaResumo,
  type TransferirRotaEntrada,
  type VersaoQuery,
} from '@rotas/shared';
import { ZodPipe } from '../../comum/pipes/zod.pipe.js';
import { Perfis, UsuarioAtual } from '../auth/decoradores.js';
import type { UsuarioAutenticado } from '../auth/tipos.js';
import { RotasComandosService } from './rotas-comandos.service.js';
import { RotasEdicaoService } from './rotas-edicao.service.js';
import { RotasService } from './rotas.service.js';

// Montagem e gestão das rotas pelo admin. Comandos do motorista ficarão em /motorista/rotas.
@Controller('rotas')
@Perfis('ADMIN')
export class RotasAdminController {
  constructor(
    private readonly rotas: RotasService,
    private readonly edicao: RotasEdicaoService,
    private readonly comandos: RotasComandosService,
  ) {}

  @Get()
  listar(@Query(new ZodPipe(filtroRotasSchema)) filtro: FiltroRotas): Promise<RespostaPaginada<RotaResumo>> {
    return this.rotas.listar(filtro);
  }

  @Get(':id')
  buscarPorId(@Param('id', new ZodPipe(idRotaSchema)) id: string): Promise<Rota> {
    return this.rotas.buscarPorId(id);
  }

  @Get(':id/historico')
  historico(@Param('id', new ZodPipe(idRotaSchema)) id: string): Promise<EventoRota[]> {
    return this.rotas.historico(id);
  }

  @Get(':id/ocorrencias')
  ocorrencias(@Param('id', new ZodPipe(idRotaSchema)) id: string): Promise<OcorrenciaRota[]> {
    return this.rotas.ocorrencias(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  criar(
    @Body(new ZodPipe(criarRotaSchema)) dados: CriarRotaEntrada,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.rotas.criar(dados, usuario);
  }

  @Put(':id')
  editar(
    @Param('id', new ZodPipe(idRotaSchema)) id: string,
    @Body(new ZodPipe(editarRotaSchema)) dados: EditarRotaEntrada,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.edicao.editar(id, dados, usuario);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  excluir(
    @Param('id', new ZodPipe(idRotaSchema)) id: string,
    @Query(new ZodPipe(versaoQuerySchema)) query: VersaoQuery,
  ): Promise<void> {
    return this.rotas.excluir(id, query.versao);
  }

  @Post(':id/enviar')
  @HttpCode(HttpStatus.OK)
  enviar(
    @Param('id', new ZodPipe(idRotaSchema)) id: string,
    @Body(new ZodPipe(comandoComVersaoSchema)) dados: ComandoComVersao,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.comandos.enviar(id, dados, usuario);
  }

  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  cancelar(
    @Param('id', new ZodPipe(idRotaSchema)) id: string,
    @Body(new ZodPipe(cancelarSchema)) dados: CancelarEntrada,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.comandos.cancelar(id, dados, usuario);
  }

  @Post(':id/transferir')
  @HttpCode(HttpStatus.OK)
  transferir(
    @Param('id', new ZodPipe(idRotaSchema)) id: string,
    @Body(new ZodPipe(transferirRotaSchema)) dados: TransferirRotaEntrada,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.comandos.transferir(id, dados, usuario);
  }

  @Post(':id/duplicar')
  @HttpCode(HttpStatus.CREATED)
  duplicar(
    @Param('id', new ZodPipe(idRotaSchema)) id: string,
    @Body(new ZodPipe(duplicarRotaSchema)) dados: DuplicarRotaEntrada,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<RotaDuplicada> {
    return this.rotas.duplicar(id, dados, usuario);
  }

  @Post(':id/paradas/:paradaId/cancelar')
  @HttpCode(HttpStatus.OK)
  cancelarParada(
    @Param('id', new ZodPipe(idRotaSchema)) id: string,
    @Param('paradaId', new ZodPipe(idParadaSchema)) paradaId: string,
    @Body(new ZodPipe(cancelarSchema)) dados: CancelarEntrada,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ): Promise<Rota> {
    return this.comandos.cancelarParada(id, paradaId, dados, usuario);
  }
}

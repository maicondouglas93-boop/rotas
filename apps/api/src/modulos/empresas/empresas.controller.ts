import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  atualizarEmpresaSchema,
  criarEmpresaSchema,
  filtroEmpresasSchema,
  idEmpresaSchema,
  type AtualizarEmpresaEntrada,
  type CriarEmpresaEntrada,
  type Empresa,
  type FiltroEmpresas,
  type RespostaPaginada,
} from '@rotas/shared';
import { ZodPipe } from '../../comum/pipes/zod.pipe.js';
import { Perfis } from '../auth/decoradores.js';
import { EmpresasService } from './empresas.service.js';

@Controller('empresas')
@Perfis('ADMIN')
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}

  @Get()
  listar(
    @Query(new ZodPipe(filtroEmpresasSchema)) filtro: FiltroEmpresas,
  ): Promise<RespostaPaginada<Empresa>> {
    return this.empresas.listar(filtro);
  }

  @Get(':id')
  buscarPorId(@Param('id', new ZodPipe(idEmpresaSchema)) id: string): Promise<Empresa> {
    return this.empresas.buscarPorId(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  criar(@Body(new ZodPipe(criarEmpresaSchema)) dados: CriarEmpresaEntrada): Promise<Empresa> {
    return this.empresas.criar(dados);
  }

  @Patch(':id')
  atualizar(
    @Param('id', new ZodPipe(idEmpresaSchema)) id: string,
    @Body(new ZodPipe(atualizarEmpresaSchema)) dados: AtualizarEmpresaEntrada,
  ): Promise<Empresa> {
    return this.empresas.atualizar(id, dados);
  }

  @Post(':id/arquivar')
  @HttpCode(HttpStatus.OK)
  arquivar(@Param('id', new ZodPipe(idEmpresaSchema)) id: string): Promise<Empresa> {
    return this.empresas.arquivar(id);
  }

  @Post(':id/reativar')
  @HttpCode(HttpStatus.OK)
  reativar(@Param('id', new ZodPipe(idEmpresaSchema)) id: string): Promise<Empresa> {
    return this.empresas.reativar(id);
  }
}

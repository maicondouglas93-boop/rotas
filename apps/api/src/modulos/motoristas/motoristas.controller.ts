import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  atualizarMotoristaSchema,
  criarMotoristaSchema,
  filtroMotoristasSchema,
  idMotoristaSchema,
  type AtualizarMotoristaEntrada,
  type CriarMotoristaEntrada,
  type FiltroMotoristas,
  type Motorista,
  type MotoristaCriado,
  type RespostaPaginada,
  type SenhaRedefinida,
} from '@rotas/shared';
import { ZodPipe } from '../../comum/pipes/zod.pipe.js';
import { Perfis } from '../auth/decoradores.js';
import { MotoristasService } from './motoristas.service.js';

@Controller('motoristas')
@Perfis('ADMIN')
export class MotoristasController {
  constructor(private readonly motoristas: MotoristasService) {}

  @Get()
  listar(@Query(new ZodPipe(filtroMotoristasSchema)) filtro: FiltroMotoristas): Promise<RespostaPaginada<Motorista>> {
    return this.motoristas.listar(filtro);
  }

  @Get(':id')
  buscarPorId(@Param('id', new ZodPipe(idMotoristaSchema)) id: string): Promise<Motorista> {
    return this.motoristas.buscarPorId(id);
  }

  /** A resposta traz a senha temporária: não pode ficar em cache. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  criar(@Body(new ZodPipe(criarMotoristaSchema)) dados: CriarMotoristaEntrada): Promise<MotoristaCriado> {
    return this.motoristas.criar(dados);
  }

  @Patch(':id')
  atualizar(
    @Param('id', new ZodPipe(idMotoristaSchema)) id: string,
    @Body(new ZodPipe(atualizarMotoristaSchema)) dados: AtualizarMotoristaEntrada,
  ): Promise<Motorista> {
    return this.motoristas.atualizar(id, dados);
  }

  @Post(':id/desativar')
  @HttpCode(HttpStatus.OK)
  desativar(@Param('id', new ZodPipe(idMotoristaSchema)) id: string): Promise<Motorista> {
    return this.motoristas.desativar(id);
  }

  @Post(':id/reativar')
  @HttpCode(HttpStatus.OK)
  reativar(@Param('id', new ZodPipe(idMotoristaSchema)) id: string): Promise<Motorista> {
    return this.motoristas.reativar(id);
  }

  @Post(':id/redefinir-senha')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  redefinirSenha(@Param('id', new ZodPipe(idMotoristaSchema)) id: string): Promise<SenhaRedefinida> {
    return this.motoristas.redefinirSenha(id);
  }
}

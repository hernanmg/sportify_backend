import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TacticalBoardsService } from './tactical-boards.service';
import {
  CreateTacticalBoardDto,
  UpdateTacticalBoardDto,
} from './dtos/tactical-board.dto';

type AuthRequest = {
  user: { id: number; role?: string };
};

@Controller('teams/:teamId/tactical-boards')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TacticalBoardsController {
  constructor(private readonly tacticalBoardsService: TacticalBoardsService) {}

  private globalRole(req: AuthRequest): string | undefined {
    return req.user?.role;
  }

  @Get()
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'player')
  list(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Request() req: AuthRequest,
  ) {
    return this.tacticalBoardsService.listByTeam(
      teamId,
      req.user.id,
      this.globalRole(req),
    );
  }

  @Get(':boardId')
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'player')
  findOne(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Request() req: AuthRequest,
  ) {
    return this.tacticalBoardsService.findOne(
      teamId,
      boardId,
      req.user.id,
      this.globalRole(req),
    );
  }

  @Post()
  @Roles('super_admin', 'manager', 'admin', 'team_captain')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Request() req: AuthRequest,
    @Body() dto: CreateTacticalBoardDto,
  ) {
    return this.tacticalBoardsService.create(
      teamId,
      req.user.id,
      dto,
      this.globalRole(req),
    );
  }

  @Patch(':boardId')
  @Roles('super_admin', 'manager', 'admin', 'team_captain')
  update(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Request() req: AuthRequest,
    @Body() dto: UpdateTacticalBoardDto,
  ) {
    return this.tacticalBoardsService.update(
      teamId,
      boardId,
      req.user.id,
      dto,
      this.globalRole(req),
    );
  }

  @Delete(':boardId')
  @Roles('super_admin', 'manager', 'admin', 'team_captain')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Request() req: AuthRequest,
  ) {
    await this.tacticalBoardsService.remove(
      teamId,
      boardId,
      req.user.id,
      this.globalRole(req),
    );
  }

  @Post(':boardId/share')
  @Roles('super_admin', 'manager', 'admin', 'team_captain')
  share(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Request() req: AuthRequest,
  ) {
    return this.tacticalBoardsService.enableShare(
      teamId,
      boardId,
      req.user.id,
      this.globalRole(req),
    );
  }

  @Delete(':boardId/share')
  @Roles('super_admin', 'manager', 'admin', 'team_captain')
  revokeShare(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Request() req: AuthRequest,
  ) {
    return this.tacticalBoardsService.revokeShare(
      teamId,
      boardId,
      req.user.id,
      this.globalRole(req),
    );
  }
}

@Controller('tactical-boards')
export class TacticalBoardsPublicController {
  constructor(private readonly tacticalBoardsService: TacticalBoardsService) {}

  @Get('shared/:token')
  findShared(@Param('token') token: string) {
    return this.tacticalBoardsService.findByShareToken(token);
  }
}

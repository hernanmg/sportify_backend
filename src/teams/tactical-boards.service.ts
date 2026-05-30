import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  TeamTacticalBoard,
  BoardStroke,
} from './entities/team-tactical-board.entity';
import {
  CreateTacticalBoardDto,
  UpdateTacticalBoardDto,
} from './dtos/tactical-board.dto';
import { TeamsService } from './teams.service';
import { PlayerStatusService } from '../player-status/player-status.service';

export interface TacticalBoardResponse {
  id: number;
  teamId: number;
  name: string;
  formation: string | null;
  lineupSlots: Record<string, { x: number; y: number }>;
  boardStrokes: BoardStroke[];
  createdByUserId: number;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class TacticalBoardsService {
  constructor(
    @InjectRepository(TeamTacticalBoard)
    private readonly boardRepository: Repository<TeamTacticalBoard>,
    private readonly teamsService: TeamsService,
    private readonly playerStatusService: PlayerStatusService,
  ) {}

  private toResponse(board: TeamTacticalBoard): TacticalBoardResponse {
    return {
      id: board.id,
      teamId: board.teamId,
      name: board.name,
      formation: board.formation,
      lineupSlots: board.lineupSlots ?? {},
      boardStrokes: board.boardStrokes ?? [],
      createdByUserId: board.createdByUserId,
      shareToken: board.shareToken,
      createdAt: board.createdAt.toISOString(),
      updatedAt: board.updatedAt.toISOString(),
    };
  }

  private async assertTeamMember(
    userId: number,
    teamId: number,
    globalRole?: string,
  ): Promise<void> {
    const elevated = ['super_admin', 'manager', 'admin'];
    if (globalRole && elevated.includes(globalRole)) return;
    const member = await this.teamsService.isTeamMember(userId, teamId);
    if (!member) {
      throw new ForbiddenException('No pertenecés a este equipo');
    }
  }

  private async assertCanManage(
    userId: number,
    teamId: number,
    globalRole?: string,
  ): Promise<void> {
    const allowedGlobal = ['super_admin', 'manager', 'admin', 'team_captain'];
    if (globalRole && allowedGlobal.includes(globalRole)) {
      if (['super_admin', 'manager', 'admin'].includes(globalRole)) return;
    }
    await this.playerStatusService.assertCanManageTeam(
      userId,
      teamId,
      globalRole,
    );
  }

  async listByTeam(
    teamId: number,
    userId: number,
    globalRole?: string,
  ): Promise<TacticalBoardResponse[]> {
    await this.assertTeamMember(userId, teamId, globalRole);
    const boards = await this.boardRepository.find({
      where: { teamId },
      order: { updatedAt: 'DESC' },
    });
    return boards.map((b) => this.toResponse(b));
  }

  async findOne(
    teamId: number,
    boardId: number,
    userId: number,
    globalRole?: string,
  ): Promise<TacticalBoardResponse> {
    await this.assertTeamMember(userId, teamId, globalRole);
    const board = await this.boardRepository.findOne({
      where: { id: boardId, teamId },
    });
    if (!board) {
      throw new NotFoundException('Táctica no encontrada');
    }
    return this.toResponse(board);
  }

  async findByShareToken(token: string): Promise<TacticalBoardResponse> {
    const board = await this.boardRepository.findOne({
      where: { shareToken: token },
    });
    if (!board || !board.shareToken) {
      throw new NotFoundException('Enlace de táctica no válido o expirado');
    }
    return this.toResponse(board);
  }

  async create(
    teamId: number,
    userId: number,
    dto: CreateTacticalBoardDto,
    globalRole?: string,
  ): Promise<TacticalBoardResponse> {
    await this.assertCanManage(userId, teamId, globalRole);
    const board = this.boardRepository.create({
      teamId,
      name: dto.name.trim(),
      formation: dto.formation?.trim() || null,
      lineupSlots: dto.lineupSlots ?? {},
      boardStrokes: (dto.boardStrokes ?? []) as BoardStroke[],
      createdByUserId: userId,
    });
    const saved = await this.boardRepository.save(board);
    return this.toResponse(saved);
  }

  async update(
    teamId: number,
    boardId: number,
    userId: number,
    dto: UpdateTacticalBoardDto,
    globalRole?: string,
  ): Promise<TacticalBoardResponse> {
    await this.assertCanManage(userId, teamId, globalRole);
    const board = await this.boardRepository.findOne({
      where: { id: boardId, teamId },
    });
    if (!board) {
      throw new NotFoundException('Táctica no encontrada');
    }
    if (dto.name !== undefined) board.name = dto.name.trim();
    if (dto.formation !== undefined) {
      board.formation = dto.formation?.trim() || null;
    }
    if (dto.lineupSlots !== undefined) board.lineupSlots = dto.lineupSlots;
    if (dto.boardStrokes !== undefined) {
      board.boardStrokes = dto.boardStrokes as BoardStroke[];
    }
    const saved = await this.boardRepository.save(board);
    return this.toResponse(saved);
  }

  async remove(
    teamId: number,
    boardId: number,
    userId: number,
    globalRole?: string,
  ): Promise<void> {
    await this.assertCanManage(userId, teamId, globalRole);
    const board = await this.boardRepository.findOne({
      where: { id: boardId, teamId },
    });
    if (!board) {
      throw new NotFoundException('Táctica no encontrada');
    }
    await this.boardRepository.remove(board);
  }

  async enableShare(
    teamId: number,
    boardId: number,
    userId: number,
    globalRole?: string,
  ): Promise<{ shareToken: string; sharePath: string }> {
    await this.assertCanManage(userId, teamId, globalRole);
    const board = await this.boardRepository.findOne({
      where: { id: boardId, teamId },
    });
    if (!board) {
      throw new NotFoundException('Táctica no encontrada');
    }
    if (!board.shareToken) {
      board.shareToken = randomUUID();
      await this.boardRepository.save(board);
    }
    return {
      shareToken: board.shareToken,
      sharePath: `/tactical-boards/shared/${board.shareToken}`,
    };
  }

  async revokeShare(
    teamId: number,
    boardId: number,
    userId: number,
    globalRole?: string,
  ): Promise<TacticalBoardResponse> {
    await this.assertCanManage(userId, teamId, globalRole);
    const board = await this.boardRepository.findOne({
      where: { id: boardId, teamId },
    });
    if (!board) {
      throw new NotFoundException('Táctica no encontrada');
    }
    board.shareToken = null;
    const saved = await this.boardRepository.save(board);
    return this.toResponse(saved);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamAuditLog } from './entities/team-audit-log.entity';

@Injectable()
export class TeamAuditService {
  constructor(
    @InjectRepository(TeamAuditLog)
    private readonly auditRepository: Repository<TeamAuditLog>,
  ) {}

  async log(params: {
    teamId: number;
    actorUserId?: number;
    action: string;
    entityType: string;
    entityId?: number;
    summary: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const row = this.auditRepository.create(params);
    await this.auditRepository.save(row);
  }

  async findByTeam(teamId: number, limit = 80) {
    return this.auditRepository.find({
      where: { teamId },
      relations: ['actor'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConvocationTemplate } from './entities/convocation-template.entity';
import { ConvocationsService } from './convocations.service';

export interface UpsertConvocationTemplateDto {
  name: string;
  defaultParticipantUserIds?: number[];
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ConvocationTemplatesService {
  constructor(
    @InjectRepository(ConvocationTemplate)
    private readonly templateRepository: Repository<ConvocationTemplate>,
    private readonly convocationsService: ConvocationsService,
  ) {}

  async list(teamId: number): Promise<ConvocationTemplate[]> {
    return this.templateRepository.find({
      where: { teamId },
      order: { name: 'ASC' },
    });
  }

  async create(
    teamId: number,
    dto: UpsertConvocationTemplateDto,
    userId: number,
    globalRole?: string,
  ): Promise<ConvocationTemplate> {
    await this.convocationsService.assertCanManageConvocation(
      userId,
      teamId,
      globalRole,
    );
    const row = this.templateRepository.create({
      teamId,
      name: dto.name,
      defaultParticipantUserIds: dto.defaultParticipantUserIds,
      metadata: dto.metadata,
      createdBy: userId,
    });
    return this.templateRepository.save(row);
  }

  async update(
    teamId: number,
    templateId: number,
    dto: Partial<UpsertConvocationTemplateDto>,
    userId: number,
    globalRole?: string,
  ): Promise<ConvocationTemplate> {
    await this.convocationsService.assertCanManageConvocation(
      userId,
      teamId,
      globalRole,
    );
    const row = await this.findOne(teamId, templateId);
    if (dto.name != null) row.name = dto.name;
    if (dto.defaultParticipantUserIds != null) {
      row.defaultParticipantUserIds = dto.defaultParticipantUserIds;
    }
    if (dto.metadata != null) row.metadata = dto.metadata;
    return this.templateRepository.save(row);
  }

  async remove(
    teamId: number,
    templateId: number,
    userId: number,
    globalRole?: string,
  ): Promise<void> {
    await this.convocationsService.assertCanManageConvocation(
      userId,
      teamId,
      globalRole,
    );
    const row = await this.findOne(teamId, templateId);
    await this.templateRepository.remove(row);
  }

  private async findOne(
    teamId: number,
    templateId: number,
  ): Promise<ConvocationTemplate> {
    const row = await this.templateRepository.findOne({
      where: { id: templateId, teamId },
    });
    if (!row) {
      throw new NotFoundException('Plantilla no encontrada');
    }
    return row;
  }
}

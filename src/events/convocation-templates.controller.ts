import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ConvocationTemplatesService,
  UpsertConvocationTemplateDto,
} from './convocation-templates.service';

@Controller('teams/:teamId/convocation-templates')
@UseGuards(AuthGuard('jwt'))
export class ConvocationTemplatesController {
  constructor(
    private readonly templatesService: ConvocationTemplatesService,
  ) {}

  @Get()
  list(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.templatesService.list(teamId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() dto: UpsertConvocationTemplateDto,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.templatesService.create(
      teamId,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Patch(':templateId')
  update(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('templateId', ParseIntPipe) templateId: number,
    @Body() dto: Partial<UpsertConvocationTemplateDto>,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.templatesService.update(
      teamId,
      templateId,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Delete(':templateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('templateId', ParseIntPipe) templateId: number,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    await this.templatesService.remove(
      teamId,
      templateId,
      req.user.id,
      req.user.role,
    );
  }
}

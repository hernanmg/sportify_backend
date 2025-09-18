import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createTeamData: any) {
    return this.teamsService.create(createTeamData);
  }

  @Get()
  findAll() {
    return this.teamsService.findAll();
  }

  @Get('search')
  searchTeams(@Query('q') query: string) {
    if (!query || query.trim().length < 2) {
      return [];
    }
    return this.teamsService.searchTeams(query.trim());
  }

  @Get('sport/:sportId')
  findBySport(@Param('sportId', ParseIntPipe) sportId: number) {
    return this.teamsService.findBySport(sportId);
  }

  @Get('football')
  getFootballTeams() {
    return this.teamsService.getFootballTeams();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id', ParseIntPipe) id: number, @Body() updateData: any) {
    return this.teamsService.update(id, updateData);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.teamsService.remove(id);
  }

  @Post('find-or-create')
  @UseGuards(AuthGuard('jwt'))
  findOrCreateByName(@Body() data: { name: string; sportId: number; categoryId?: number }) {
    return this.teamsService.findOrCreateByName(data.name, data.sportId, data.categoryId);
  }
}

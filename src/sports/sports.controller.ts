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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SportsService } from './sports.service';
import { CreateSportDto } from './dtos/create-sport.dto';
import { UpdateSportDto } from './dtos/update-sport.dto';

@Controller('sports')
export class SportsController {
  constructor(private readonly sportsService: SportsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  create(@Body() createSportDto: CreateSportDto) {
    return this.sportsService.create(createSportDto);
  }

  @Get()
  findAll() {
    return this.sportsService.findAll();
  }

  @Post('seed/defaults')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  seedDefaults() {
    return this.sportsService.seedDefaults();
  }

  @Get(':id/positions')
  getPositions(@Param('id', ParseIntPipe) id: number) {
    return this.sportsService.getPositions(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sportsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSportDto: UpdateSportDto,
  ) {
    return this.sportsService.update(id, updateSportDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sportsService.remove(id);
  }
}

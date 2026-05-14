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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get('sport/:sportId')
  findBySport(@Param('sportId', ParseIntPipe) sportId: number) {
    return this.categoriesService.findBySport(sportId);
  }

  @Get('football')
  getFootballCategories() {
    return this.categoriesService.getFootballCategories();
  }

  @Post('seed/football')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  seedFootballCategories(@Body() body?: { sportId?: number }) {
    return this.categoriesService.seedFootballCategories(body?.sportId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Patch(':id/toggle')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.toggleActive(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.remove(id);
  }
}

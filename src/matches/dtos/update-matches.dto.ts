import { PartialType } from '@nestjs/mapped-types';
import { CreateMatchDto } from './create-matches.dto';

export class UpdateMatchDto extends PartialType(CreateMatchDto) {}

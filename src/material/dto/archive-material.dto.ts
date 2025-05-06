import { PickType } from '@nestjs/swagger';
import { BaseMaterialDto } from './base-material.dto';

export class ArchiveMaterialDto extends PickType(BaseMaterialDto, ['id', 'is_archived']) {}

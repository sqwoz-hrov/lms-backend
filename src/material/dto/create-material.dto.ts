import { OmitType } from '@nestjs/swagger';
import { BaseMaterialDto } from './base-material.dto';

export class CreateMaterialDto extends OmitType(BaseMaterialDto, ['id', 'markdown_content_id', 'is_archived']) {}

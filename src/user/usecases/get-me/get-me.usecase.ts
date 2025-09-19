import { Injectable } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { User } from '../../../user/user.entity';
import { UserResponseDto } from '../../dto/signup.dto';

@Injectable()
export class GetMeUsecase implements UsecaseInterface {
	execute({ user }: { user: User }): UserResponseDto {
		return user;
	}
}

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { OTP } from '../../core/otp';
import { OTPService } from '../../core/otp.service';
import { UserRepository } from '../../user.repository';
import { SubscriptionService } from '../../../subscription/services/subscription.service';

@Injectable()
export class FinishRegistrationUsecase implements UsecaseInterface {
	constructor(
		private readonly otpService: OTPService,
		private readonly repo: UserRepository,
		private readonly subscriptionService: SubscriptionService,
	) {}

	public async execute({ inputOtp, email }: { inputOtp: OTP; email: string }): Promise<{ success: boolean }> {
		const user = await this.repo.findByEmail(email);
		if (!user) return { success: false };

			const isValid = await this.otpService.isOtpValid({
				userId: user.id,
				userInputOtp: inputOtp,
			});

			if (!isValid) {
				return { success: false };
			}



		await this.repo.transaction(async trx => {
			const lockedUser = await trx
				.selectFrom('user as u')
				.leftJoin('subscription as s', 's.user_id', 'u.id')
				.selectAll('u')
				.select('s.id as sub_id')
				.where('u.id', '=', user.id)
				.forUpdate('u')
				.limit(1)
				.executeTakeFirst();

			if (!lockedUser) {
				return { success: false };
			}

			if (!lockedUser.finished_registration) {
				await trx.updateTable('user').set({ finished_registration: true }).where('id', '=', lockedUser.id).execute();
			}

			const { sub_id: subId, ...userInfo } = lockedUser;

			if (subId) {
				throw new InternalServerErrorException('Subscription already exists');
			}

			await this.subscriptionService.handleRegistration({
				user: userInfo,
			}, trx);
		});

		return { success: true };
	}
}

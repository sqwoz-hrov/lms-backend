import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { SubscriptionManagerFactory } from '../../../subscription/domain/subscription-manager.factory';
import { SubscriptionActionExecutor } from '../../../subscription/services/subscription-action.executor';
import { SubscriptionRepository } from '../../../subscription/subscription.repository';
import { OTP } from '../../core/otp';
import { OTPService } from '../../core/otp.service';
import { UserRepository } from '../../user.repository';

@Injectable()
export class FinishRegistrationUsecase implements UsecaseInterface {
	constructor(
		private readonly otpService: OTPService,
		private readonly repo: UserRepository,
		private readonly subscriptionRepository: SubscriptionRepository,
		private readonly subscriptionManagerFactory: SubscriptionManagerFactory,
		private readonly subscriptionActionExecutor: SubscriptionActionExecutor,
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

		const manager = await this.subscriptionManagerFactory.create();

		await this.subscriptionRepository.transaction(async trx => {
			const lockedUser = await trx
				.selectFrom('user')
				.selectAll()
				.where('id', '=', user.id)
				.forUpdate()
				.limit(1)
				.executeTakeFirst();

			if (!lockedUser) {
				return;
			}

			if (!lockedUser.finished_registration) {
				await trx.updateTable('user').set({ finished_registration: true }).where('id', '=', lockedUser.id).execute();
			}

			const existingSubscription = await this.subscriptionRepository.findByUserId(lockedUser.id, trx);

			if (existingSubscription) {
				throw new InternalServerErrorException('Subscription already exists');
			}

			const { action } = manager.handleRegistration({
				user: { id: lockedUser.id },
			});

			await this.subscriptionActionExecutor.execute({
				action,
				trx,
			});
		});

		return { success: true };
	}
}

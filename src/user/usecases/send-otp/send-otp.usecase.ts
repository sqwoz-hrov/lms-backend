import { Inject, Injectable, Logger } from '@nestjs/common';
import { UsecaseInterface } from '../../../common/interface/usecase.interface';
import { OTPService } from '../../core/otp.service';
import { TELEGRAM_ADAPTER } from '../../../telegram/constants';
import { IOTPSender } from '../../ports/otp-sender.port';
import { UserRepository } from '../../user.repository';

type SendOtpExecuteResult = { status: 'otp_sent' | 'pending_contact' | 'delivery_failed' };

@Injectable()
export class SendOtpUsecase implements UsecaseInterface {
	private readonly logger = new Logger(SendOtpUsecase.name);

	constructor(
		private readonly repo: UserRepository,
		private readonly otpService: OTPService,
		@Inject(TELEGRAM_ADAPTER) private readonly otpSender: IOTPSender<'telegram'>,
	) {}

	public async execute({ email }: { email: string }): Promise<SendOtpExecuteResult | undefined> {
		const user = await this.repo.findByEmail(email);
		if (!user) {
			return undefined;
		}

		const otp = await this.otpService.createOtp(user.id);

		if (!user.telegram_id) {
			this.logger.warn(`Telegram ID не найден для пользователя ${email}, OTP сохранён без отправки`);
			return { status: 'pending_contact' };
		}

		const sent = await this.otpSender.sendOTP({ telegram_id: user.telegram_id }, otp);
		if (!sent) {
			this.logger.warn(`Не удалось отправить OTP в Telegram для пользователя ${email}`);
			return { status: 'delivery_failed' };
		}

		return { status: 'otp_sent' };
	}
}

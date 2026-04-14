import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { aiUsageLimitsConfig } from '../../config';
import { Limit, LimitableResource } from './limits.domain';

@Injectable()
export class LimitsService {
    private readonly limits = new Map<LimitableResource, Limit[]>();

    constructor(
        @Inject(aiUsageLimitsConfig.KEY)
        private readonly config: ConfigType<typeof aiUsageLimitsConfig>,
    ) {
        this.limits.set('interview_transcription', [
            Limit.create({
                feature: 'interview_transcription',
                limit: this.config.interviewTranscriptionDaily,
                period: 'daily',
            }),
            Limit.create({
                feature: 'interview_transcription',
                limit: this.config.interviewTranscriptionHourly,
                period: 'hourly',
            }),
        ]);
    }

    public getAppliedLimitsForUser(feature: LimitableResource): Limit[] {
        return this.limits.get(feature) ?? [];
    }

    public getExceededLimitsForUser(
        feature: LimitableResource,
        usageStats: { lastDay: number; lastHour: number },
    ): Limit[] {
        const limitsForFeature = this.getAppliedLimitsForUser(feature);
        if (limitsForFeature.length === 0) {
            return [];
        }

        const exceededLimits: Limit[] = [];
        for (const limit of limitsForFeature) {
            if (limit.getPeriod() === 'daily' && usageStats.lastDay >= limit.getLimit()) {
                exceededLimits.push(limit);
            }

            if (limit.getPeriod() === 'hourly' && usageStats.lastHour >= limit.getLimit()) {
                exceededLimits.push(limit);
            }
        }

        return exceededLimits;
    }
}
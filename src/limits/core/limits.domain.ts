export const LIMITABLE_RESOURCES = ['interview_transcription'] as const;
export const LIMIT_PERIODS = ['daily', 'hourly'] as const;

export type LimitableResource = (typeof LIMITABLE_RESOURCES)[number];
export type LimitPeriod = (typeof LIMIT_PERIODS)[number];

export class Limit {
    private constructor(
        private readonly feature: LimitableResource,
        private readonly limit: number,
        private readonly period: LimitPeriod,
    ) {}

    static create({ feature, limit, period }: { feature: LimitableResource; limit: number; period: LimitPeriod }) {
        if (limit <= 0) {
            throw new Error(`Invalid limit: ${limit}`);
        }

        return new Limit(feature, limit, period);
    }

    getName(): `${LimitableResource}_${LimitPeriod}_${number}` {
        return `${this.feature}_${this.period}_${this.limit}`;
    }

    getLimit(): number {
        return this.limit;
    }

    getPeriod(): LimitPeriod {
        return this.period;
    }

    getFeature(): LimitableResource {
        return this.feature;
    }

    toPlain() {
        return {
            feature: this.feature,
            period: this.period,
            limit: this.limit,
            name: this.getName(),
        };
    }
}
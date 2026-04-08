const { randomBytes } = require('crypto');
// POC for workflow steps yielding dependencies and results to each other
const createStepsIterator = async function* <T extends (Step | SelfYieldingStep)>(steps: readonly T[]): AsyncGenerator<T> {
    for (const step of steps) {
            console.log(`[PIPELINE] Awaiting next step ${step.name}`);
            // should yield a promise that will be resolved
            const actualStep = await step.promise;
            console.log(`[PIPELINE] Yielding next step ${step.name}`);
            yield actualStep;
    }
    return;
}

type WorkflowSteps = [Step, Step, Step, SelfYieldingStep];

class Workflow {

    constructor(steps: WorkflowSteps, private readonly stepsIterator = createStepsIterator(steps)) {}

    async execute() {
        // actually, we CAN have the types. But we'll have to go the other way around
        // have map that maps the arguments (with special branded field like sep name) to step classes,
        // no matches = never. And boom, sane inference
        // only for first call :/ Bc we cannot infer for-of
        // I meeean who need types anyways. We could have some typeguars like "this steps results should match to this and this input". Maybe always 
        // do like
        // const adapter = (result: ZalupaStepResult) => ({}) as ZalupaNextStepInput 
        // once again, how to infer with for-of?
        // How did the guys in n8n / temporal do it?
        const firstStep = await this.stepsIterator.next();
        console.log('[RUN] First step:', firstStep.value?.name);
        let previousCallResult;
        if (firstStep.value) {
            const apiCallResult = await firstStep.value.run({ a: 1 });
            console.log(`[RUN] API call ${firstStep.value.name} result:`, apiCallResult);
            previousCallResult = apiCallResult;
        }

        let stepIdx = 2;
        for await (const step of this.stepsIterator) {
            console.log(`[RUN] Running step ${step.name} with index ${stepIdx}`);
            const apiCallResult = await step.run(previousCallResult);
            console.log(`[RUN] API call ${step.name} result:`, apiCallResult);
            previousCallResult = apiCallResult;
            stepIdx++;
        }
    }

}


class Step  {
    public readonly name: string;
    protected resolver: ((value: unknown) => void) | null = null;
    public promise: Promise<Step> = new Promise(r => { this.resolver = r; this.resolver(this); });

    constructor(name: string) {
        this.name = name;
    }


    async run(params: { a: number }) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { foo: this.name,}
    }

    // this cannot be a generator, this should progress the workflow though
    async handleResult(res: { foo: string}) {
        console.log(`[STEP CALLBACK] Handling result for step ${this.name}:`, res);
        const resolve = this.resolver;
        this.promise = new Promise(r => this.resolver = r);
        resolve?.(res);
        console.log(`[STEP CALLBACK] Step ${this.name} is done!`);
        return 3;
    }
}

class SelfYieldingStep  {
    public readonly name: string;
    protected resolver: ((value: unknown) => void) | null = null;
    public promise: Promise<Step> = new Promise(r => { this.resolver = r; this.resolver(this); });

    constructor(name: string) {
        this.name = name;
    }

    async run(params: { a: number }) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const runResult = { foo: 'FOOO',}
        await this.handleResult(runResult);
        return runResult;
    }

    // this cannot be a generator, this should progress the workflow though
    async handleResult(res: { foo: string}) {
        console.log(`[STEP CALLBACK] Handling result for step ${this.name}:`, res);
        const resolve = this.resolver;
        this.promise = new Promise(r => this.resolver = r);
        resolve?.(res);
        console.log(`[STEP CALLBACK] Step ${this.name} is done!`);
    }
}

const controller = async (yieldingDep: Step) => {
    const res = { foo: 'bar',}
    await yieldingDep.handleResult(res);
    console.log('[CONTROLLER] Finished controller!');
    return 'ok';
}

(async () => {
    const step = new Step('1');
    const step2 = new Step('2');
    const step3 = new Step('3');
    const step4 = new SelfYieldingStep('4');
    const steps = [step, step2, step3, step4] as const;
    const workflow = new Workflow(steps);

    await workflow.execute();

    const res = await controller(step);
    console.log('[CONTROLLER] Controller done', res);
    const res2 = await controller(step2);
    console.log('[CONTROLLER] Controller done', res2);
})();


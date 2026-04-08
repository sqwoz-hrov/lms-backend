import { Injectable } from '@nestjs/common';

type AbstractConstructor<TInstance = object> = abstract new (...args: any[]) => TInstance;

type BasicRequiredKeys = 'run' | 'setHooks';

/**
 * Marks a class as Nest injectable and enforces required instance properties at compile-time.
 *
 * Usage:
 *   @Workflow<'run' | 'name'>()
 *   class MyWorkflow {
 *     run() {}
 *     name = 'demo';
 *   }
 */
export function Workflow<TRequiredKeys extends PropertyKey = BasicRequiredKeys>() {
    type RequiredShape = {
        [K in TRequiredKeys]: unknown;
    };

    return function <TClass extends AbstractConstructor<RequiredShape>>(
        target: TClass,
    ): void {
        Injectable()(target);
    };
}
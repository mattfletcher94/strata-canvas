import { ComputedRef, EffectScope } from '@vue/reactivity';
import { SubscribableQuery } from './types';
export declare function makeSubscribable<T>(computedRef: ComputedRef<T>, scope: EffectScope): SubscribableQuery<T>;
export declare function makeParameterisedQuery<TArgs extends unknown[], TResult>(factory: (...args: TArgs) => (() => TResult) | SubscribableQuery<TResult>, scope: EffectScope, maxCacheSize?: number): (...args: TArgs) => SubscribableQuery<TResult>;
export declare function resolveQueries(queriesFn: ((injected: any) => Record<string, (...args: any[]) => any>) | undefined, injected: any, scope: EffectScope): Record<string, SubscribableQuery<any> | ((...args: any[]) => SubscribableQuery<any>)>;

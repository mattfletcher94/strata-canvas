import { StoreConfig, StoreBlueprint, TransformQueries, EventCreators, AsyncFnKeys, StrataTypeError } from './types';
type StoreResult<TQueries, TProjections> = [AsyncFnKeys<TQueries>] extends [never] ? StoreBlueprint<TransformQueries<TQueries> & EventCreators<TProjections>> : StrataTypeError<`Store query "${AsyncFnKeys<TQueries> & string}" returns a Promise. Queries must be synchronous derivations of state.`>;
export declare function defineStore<TState extends object, TQueries extends Record<string, (...args: any[]) => any>, TProjections extends Record<string, (state: Readonly<TState>, payload?: any) => TState>>(config: StoreConfig<TState, TQueries, TProjections>): StoreResult<TQueries, TProjections>;
export {};

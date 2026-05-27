import { StrataConfig, ResolvedStrata } from './types';
export declare function createStrata<TConfig extends StrataConfig>(config: TConfig): ResolvedStrata<TConfig>;

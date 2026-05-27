declare const STRATA_ERROR: unique symbol;
export interface ReactionResult {
    readonly module: string;
    readonly reaction: string;
    readonly status: "fulfilled" | "rejected";
    readonly value?: unknown;
    readonly reason?: unknown;
}
export declare class StrataError extends Error {
    readonly [STRATA_ERROR] = true;
    constructor(message: string);
}
export declare class ReactionError extends StrataError {
    readonly results: readonly ReactionResult[];
    constructor(results: readonly ReactionResult[]);
}
export declare class CommandUnresolvedError extends StrataError {
    readonly module: string;
    readonly command: string;
    readonly corrId: string;
    constructor(module: string, command: string, corrId: string);
}
export declare function strataError(message: string): never;
export {};

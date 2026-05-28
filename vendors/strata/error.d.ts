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
export interface CommandUnresolvedDiagnostics {
    readonly expectedOk?: {
        readonly store: string;
        readonly event: string;
    };
    readonly expectedFail?: {
        readonly store: string;
        readonly event: string;
    };
    readonly firedEvents: readonly {
        readonly store: string;
        readonly event: string;
    }[];
    readonly reactionsInvoked: readonly {
        readonly module: string;
        readonly reaction: string;
        readonly status: "succeeded" | "failed" | "aborted";
    }[];
}
export declare class CommandUnresolvedError extends StrataError {
    readonly module: string;
    readonly command: string;
    readonly corrId: string;
    readonly expectedOk?: {
        readonly store: string;
        readonly event: string;
    };
    readonly expectedFail?: {
        readonly store: string;
        readonly event: string;
    };
    readonly firedEvents: readonly {
        readonly store: string;
        readonly event: string;
    }[];
    readonly reactionsInvoked: readonly {
        readonly module: string;
        readonly reaction: string;
        readonly status: "succeeded" | "failed" | "aborted";
    }[];
    constructor(module: string, command: string, corrId: string, diagnostics?: CommandUnresolvedDiagnostics);
}
export declare function strataError(message: string): never;
export {};

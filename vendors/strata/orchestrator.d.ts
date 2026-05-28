import { OrchestratorBlueprint, StoreBlueprint, ServiceBlueprint, TransformQueries, ResolveOrchestratorCommands, ResolveLiveQueries, ResolveCommandSubscriptions, ResolveDeps, ResolveServices, LiveQueryHandler, ReactionHandler } from './types';
export declare function defineOrchestrator<TDeps extends Record<string, StoreBlueprint | OrchestratorBlueprint>, TServices extends Record<string, ServiceBlueprint>, TQueries extends Record<string, (...args: any[]) => any>, TCommands extends Record<string, (...args: any[]) => any>, TReactions extends Record<string, ReactionHandler<any, any>>, TLive extends Record<string, LiveQueryHandler<any, any>>>(config: {
    readonly name: string;
    readonly responsibility?: string;
    readonly deps: TDeps;
    readonly services: TServices;
    readonly queries?: (deps: ResolveDeps<TDeps>) => TQueries;
    readonly commands?: (deps: ResolveDeps<TDeps>) => TCommands;
    readonly reactions?: (deps: ResolveDeps<TDeps>, services: ResolveServices<TServices>, commands: ResolveCommandSubscriptions<TCommands>) => TReactions;
    readonly liveQueries?: (deps: ResolveDeps<TDeps>, services: ResolveServices<TServices>) => TLive;
}): OrchestratorBlueprint<TransformQueries<TQueries> & ResolveOrchestratorCommands<TCommands> & ResolveLiveQueries<TLive>>;
export declare function defineOrchestrator<TDeps extends Record<string, StoreBlueprint | OrchestratorBlueprint>, TQueries extends Record<string, (...args: any[]) => any>, TCommands extends Record<string, (...args: any[]) => any>, TReactions extends Record<string, ReactionHandler<any, any>>, TLive extends Record<string, LiveQueryHandler<any, any>>>(config: {
    readonly name: string;
    readonly responsibility?: string;
    readonly deps: TDeps;
    readonly queries?: (deps: ResolveDeps<TDeps>) => TQueries;
    readonly commands?: (deps: ResolveDeps<TDeps>) => TCommands;
    readonly reactions?: (deps: ResolveDeps<TDeps>, services: any, commands: ResolveCommandSubscriptions<TCommands>) => TReactions;
    readonly liveQueries?: (deps: ResolveDeps<TDeps>, services: any) => TLive;
}): OrchestratorBlueprint<TransformQueries<TQueries> & ResolveOrchestratorCommands<TCommands> & ResolveLiveQueries<TLive>>;

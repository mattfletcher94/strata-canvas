import { DependencyTree, StrataConfig } from './types';
export declare function buildDependencyTree(config: StrataConfig, reactionNames?: Record<string, string[]>, liveQueryNames?: Record<string, string[]>): DependencyTree;
export declare function inspectDAG(graph: object): DependencyTree;
export declare function toMermaid(tree: DependencyTree): string;

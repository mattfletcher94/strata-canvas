import { ServiceConfig, ServiceBlueprint } from './types';
/**
 * Define a service blueprint.
 *
 * A service wraps an external system. Services see nothing — no deps, no stores, no other services.
 * Use `.with(config)` to bind setup config at the composition site.
 */
export declare function defineService<TApi, TConfig = void>(config: ServiceConfig<TApi, TConfig>): ServiceBlueprint<Awaited<TApi>, TConfig>;

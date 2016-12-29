import { Promise, Set } from "core-js";
import Session from "./session";
import { Driver, READ, WRITE, AuthCredentials, ConfigurationOptions } from "./driver";
import { newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED } from "./error";
import RoundRobinArray from "./internal/round-robin-array";
import Integer, { int } from "./integer";

declare class RoutingDriver extends Driver {
  _clusterView: ClusterView;
  constructor(url: string,
    userAgent: string,
    token: AuthCredentials,
    config: ConfigurationOptions )

  _createSession( connectionPromise: Promise<Connection>, cb: Function ): RoutingSession;

  _updatedClusterView(): Promise<ClusterView>

  _diff( oldView: any, updatedView: any ): any;

  _acquireConnection( mode: string ): Promise<any>;

  _forget( url: string ): void;

  static _validateConfig( config: ConfigurationOptions ): ConfigurationOptions;
}

declare class ClusterView {
  routers: RoundRobinArray;
  readers: RoundRobinArray;
  writers: RoundRobinArray;
  _expires: Integer;
  constructor( routers: RoundRobinArray,
    readers: RoundRobinArray,
    writers: RoundRobinArray,
    expires: Integer )

  needsUpdate(): boolean;

  all(): Set;

  remove(): void;
}

declare class RoutingSession extends Session {
  _onFailedConnection: Function;
  constructor(connectionPromise: Promise<Connection>,
    onClose: Function,
    onFailedConnection: Function)

  _onRunFailure(): Function;
}

declare function newClusterView( session: Session ): Promise<ClusterView>;

export default RoutingDriver;

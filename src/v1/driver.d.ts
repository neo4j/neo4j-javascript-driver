import { Promise } from "core-js";

import Session from "./session";
import Pool from "./internal/pool";
import Integer from "./integer";
import { connect, Connection } from "./internal/connector";
import StreamObserver from "./internal/stream-observer";
import { newError, SERVICE_UNAVAILABLE } from "./error";

interface AuthCredentials {
  scheme: string;
  principal: string;
  credentials: string;
  realm?: string;
  parameters?: {[key: string]: any};
}

interface ConfigurationOptions {
  encrypted?: string;
  trust?: string;
  trustedCertificates?: any[];
  knownHosts?: string;
}

declare type READ = "READ";
declare type WRITE = "WRITE";

declare class Driver {
  constructor(url: string,
    userAgent: string,
    token: AuthCredentials,
    config: ConfigurationOptions)

  _createConnection( url: string,
    release: ( url: string, conn: Connection ) => void
  ): Connection;

  static _validateConnection( conn: Connection ): Boolean

  _destroyConnection( conn: Connection ): void;

  session( mode: string ): Session;

  _acquireConnection( mode: string ): Promise<Connection>;

  _createSession(connectionPromise: Promise<Connection>, cb: Function): Session;

  close(): void;
}

declare class _ConnectionStreamObserver extends StreamObserver {
  constructor( driver: Driver, conn: Connection )

  onError( error: Error ): void;

  onCompleted( message: any ): void;
}

export { Driver, READ, WRITE, AuthCredentials, ConfigurationOptions }

export default Driver;

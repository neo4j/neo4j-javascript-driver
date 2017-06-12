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
  parameters?: { [key: string]: any };
}

interface ConfigurationOptions {
  encrypted?: string;
  trust?: string;
  trustedCertificates?: any[];
  knownHosts?: string;
}

declare const READ: string;
declare const WRITE: string;

declare class Driver {
  constructor(
    url: string,
    userAgent: string,
    token: AuthCredentials,
    config?: ConfigurationOptions
  );

  protected _destroyConnection(conn: Connection): void;
  protected _acquireConnection(mode: string): PromiseLike<Connection>;
  protected _createSession(connectionPromise: PromiseLike<Connection>, cb: Function): Session;
  protected _createConnection(url: string,
    release: (url: string, conn: Connection) => void
  ): Connection;
  static _validateConnection(conn: Connection): Boolean
  session(mode?: string): Session;
  close(): void;
}

declare class _ConnectionStreamObserver<T> extends StreamObserver<T> {
  constructor(driver: Driver, conn: Connection);

  onError(error: Error): void;
  onCompleted(message: any): void;
}

export { Driver, READ, WRITE, AuthCredentials, ConfigurationOptions }

export default Driver;

import { ConfigurationOptions } from "../driver";

declare class Connection {
  constructor(channel: { write: Function, onMessage: Function }, url: string);

  initialise(
    clientName: string,
    token: any,
    observer: any
  ): void;

  run(
    statement: any,
    params: Object,
    observer: any
  ): void;

  pullAll(observer: any): void;
  discardAll(observer: any): void;
  reset(observer: any): void;
  sync(): any;
  isOpen(): boolean;
  isEncrypted(): boolean;
  close(cb?: Function): void;
  setServerVersion(version: string): void;
}

declare function connect(
  url: string,
  config?: ConfigurationOptions
): Connection;

declare function parseScheme(url: string): string;
declare function parseUrl(url: string): string;

export {
  connect,
  Connection,
  parseScheme,
  parseUrl,
}
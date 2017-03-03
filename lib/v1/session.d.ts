import { Connection } from './internal/connector'
import StreamObserver from "./internal/stream-observer";
import Result from "./result";
import Transaction from "./transaction";
import Integer, { int } from "./integer";
import { newError } from "./error";

declare class Session {
  _connectionPromise: PromiseLike<Connection>;
  _onClose: Function;
  _hasTx: boolean;

  constructor(
    connectionPromise: PromiseLike<Connection>,
    onClose: Function
  );

  run<T, Params extends { [index: string]: any }>(statement: string, parameters?: Params): Result<T, Params>;
  run<T>(statement: string): Result<T, {}>;
  beginTransaction(bookmark?: any): Transaction;
  lastBookmark(): any;
  close(cb?: () => void): void;
  protected _onRunFailure(): Function;
}

declare class _RunObserver<T> extends StreamObserver<T> {
  constructor(
    onError: Function
  );

  onCompleted(meta: Object): void;
  meta(): Object;
}

export default Session;

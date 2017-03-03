import { Connection } from './internal/connector'
import StreamObserver from "./internal/stream-observer";
import Result from "./result";

declare class Transaction {
  constructor(
    connectionPromise: PromiseLike<Connection>,
    onClose: Function,
    errorTransformer: Function,
    bookmark?: any,
    onBookmark?: Function
  );

  run<T, Params extends { [index: string]: any }>(statement: any, parameters: Params): Result<T, Params>;
  run<T>(statement: any): Result<T, {}>;
  commit<T>(): Result<T, {}>;
  rollback<T>(): Result<T, {}>;
  _onError(): void;
}

declare function _runDiscardAll<T>(
  msg: any,
  connectionPromise: PromiseLike<Connection>,
  observer: StreamObserver<T>
): Result<T, {}>;

export default Transaction;

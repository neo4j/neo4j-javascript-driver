import { Promise } from "core-js";
import StreamObserver from "./internal/stream-observer";
import Result from "./result";

declare class Transaction {
  constructor(connectionPromise: Promise<Connection>,
    onClose: Function,
    errorTransformer: Function,
    bookmark?: any,
    onBookmark?: Function)

  run( statement: any, parameters: Object ): Result;

  commit(): Result;

  rollback(): Result;

  _onError(): void;
}

declare function _runDiscardAll( msg: any,
  connectionPromise: Promise<Connection>,
  observer: StreamObserver): Result;

export default Transaction;

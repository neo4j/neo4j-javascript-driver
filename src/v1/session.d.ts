import { Promise } from "core-js";

import StreamObserver from "./internal/stream-observer";
import Result from "./result";
import Transaction from "./transaction";
import Integer, { int } from "./integer";
import { newError } from "./error";

declare class Session {
  _connectionPromise: Promise<Connection>;
  _onClose: Function;
  _hasTx: boolean;
  constructor( connectionPromise: Promise<Connection>,
    onClose: Function )

  run( statement: any, parameters: Object ): Result;

  beginTransaction( bookmark: any ): Transaction;

  lastBookmark(): any;

  close( cb: () => void ): void;

  _onRunFailure(): Function;
}

declare class _RunObserver extends StreamObserver {
  constructor( onError: Function )

  onCompleted( meta: Object ): void;

  meta(): Object;
}

export default Session;

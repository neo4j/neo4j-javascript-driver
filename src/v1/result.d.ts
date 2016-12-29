import Promise from "core-js";

import ResultSummary from "./result-summary";
import Record from "./record";
import StreamObserver from "./internal/stream-observer";

declare class Result {
  _streanObserver: StreamObserver;
  _p: Promise<{records: ArrayRecord, summary: any}> | null;
  constructor( streamObserver: StreamObserver,
    statement: any,
    parameters: Object,
    metaSupplier: Function)

  _createPromise(): Promise<{records: ArrayRecord, summary: any}>;

  then( onFulfilled: (result: {records: Array<Record>}) =>
      Promise<{records: ArrayRecord, summary: any}>,
    onRejected: (error: {message: string, code: string}) =>
      void,
  ): Promise<{records: ArrayRecord, summary: any}>;

  catch( onRejected: (error: {message: string, code: string}) =>
    void
  ): Promise<{records: ArrayRecord, summary: any}>;

  subscribe( observer: StreamObserver ): void;
}

export default Result;

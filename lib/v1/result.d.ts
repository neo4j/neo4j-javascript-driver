import ResultSummary from "./result-summary";
import Record from "./record";
import StreamObserver, { StreamObserverInterface } from "./internal/stream-observer";

declare type ResultType<T> = {
  records: Array<Record<T>>;
  summary: ResultSummary;
}

declare type PromiseResult<T> = PromiseLike<ResultType<T>>

declare class Result<T, Params extends { [index: string]: any }> extends Promise<ResultType<T>> {
  _streamObserver: StreamObserver<T>;
  _p: PromiseResult<T> | null;
  _statement: string;
  _parameters: Params;
  _metaSupplier: () => any;

  constructor(
    streamObserver: StreamObserver<T>,
    statement: string,
    parameters?: Params,
    metaSupplier?: () => any
  );

  protected _createPromise(): PromiseResult<T>;
  subscribe(observer: StreamObserverInterface<Record<T>>): void;
}

export default Result;

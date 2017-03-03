import ResultSummary from '../result-summary'

declare type ErrorTransformer = <T extends Error>(err: Error) => T;

export declare interface StreamObserverInterface<T> {
  onNext?(record: T): void;
  onCompleted?(summary?: ResultSummary): void;
  onError?(err: Error): void;
}

declare class StreamObserver<T> implements StreamObserverInterface<T> {
  constructor(errorTransformer: ErrorTransformer);
}

export default StreamObserver;

declare type ErrorTransformer = <T extends Error>(err: Error) => T;

declare class StreamObserver {
  constructor(errorTransformer: ErrorTransformer);
}

export default StreamObserver;

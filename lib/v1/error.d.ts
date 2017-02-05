declare const SERVICE_UNAVAILABLE: string;
declare const SESSION_EXPIRED: string;

declare function newError(message: any, code: string): Neo4jError;

declare class Neo4jError extends Error {
  code: string;
  message: string;

  constructor(message: any, code: string);
}

export {
  newError,
  Neo4jError,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED,
}

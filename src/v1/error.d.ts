type SERVICE_UNAVAILABLE = "ServiceUnavailable";
type SESSION_EXPIRED = "SessionExpired";

declare function newError( message: any, code: string ): Neo4jError;

declare class Neo4jError extends Error {
  constructor( message: any, code: string )
}

export {
  newError,
  Neo4jError,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED,
}

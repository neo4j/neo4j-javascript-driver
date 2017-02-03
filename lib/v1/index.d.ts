import { int, isInt, inSafeRange, toNumber, toString } from "./integer";
import { Node, Relationship, UnboundRelationship, PathSegment, Path } from "./graph-types";
import { Neo4jError, SERVICE_UNAVAILABLE, SESSION_EXPIRED } from "./error";
import Result from "./result";
import ResultSummary from "./result-summary";
import Record from "./record";
import { Driver, READ, WRITE, AuthCredentials, ConfigurationOptions } from "./driver";
import RoutingDriver from "./routing-driver";
import VERSION from "../version";
import { parseScheme, parseUrl } from "./internal/connector";

declare const auth: {
  basic: (username: string,
    password: string,
    realm?: string) => AuthCredentials,
  custom: (principal: string,
    credentials: string,
    realm: string,
    scheme: string,
    parameters?: { [key: string]: any }) => AuthCredentials,
};

declare const USER_AGENT: string;

declare function driver(url: string,
  authToken: AuthCredentials,
  config?: ConfigurationOptions): Driver;

declare const types: {
  Node: typeof Node;
  Relationship: typeof Relationship;
  UnboundRelationship: typeof UnboundRelationship;
  PathSegment: typeof PathSegment;
  Path: typeof Path;
  Result: typeof Result;
  ResultSummary: typeof ResultSummary;
  Record: typeof Record;
};

declare const session: {
  READ: typeof READ;
  WRITE: typeof WRITE;
};

declare const error: {
  SERVICE_UNAVAILABLE: typeof SERVICE_UNAVAILABLE;
  SESSION_EXPIRED: typeof SESSION_EXPIRED;
};

declare const integer: {
  toNumber: typeof toNumber;
  toString: typeof toString;
  inSafeRange: typeof inSafeRange;
};

declare const forExport: {
  driver: typeof driver;
  int: typeof int;
  isInt: typeof isInt;
  integer: typeof integer;
  Neo4jError: typeof Neo4jError;
  auth: typeof auth;
  types: typeof types;
  session: typeof session;
  error: typeof error;
  AuthCredentials: AuthCredentials;
  ConfigurationOptions: ConfigurationOptions;
};

export {
  driver,
  int,
  isInt,
  integer,
  Neo4jError,
  auth,
  types,
  session,
  error,
  AuthCredentials,
  ConfigurationOptions,
}

export default forExport;

import {int, isInt, inSafeRange, toNumber, toString} from "./integer";
import {Node, Relationship, UnboundRelationship, PathSegment, Path} from "./graph-types";
import {Neo4jError, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from "./error";
import Result from "./result";
import ResultSummary from "./result-summary";
import Record from "./record";
import {Driver, READ, WRITE, AuthCredentials, ConfigurationOptions} from "./driver";
import RoutingDriver from "./routing-driver";
import VERSION from "../version";
import {parseScheme, parseUrl} from "./internal/connector";

declare type auth = {
  basic: (username: string,
    password: string,
    realm?: string ) => AuthCredentials,
  custom: ( principal: string,
    credentials: string,
    realm: string,
    scheme: string,
    parameters?: {[key: string]: any} ) => AuthCredentials,
};

declare type USER_AGENT= string;

declare function driver(url: string,
  authToken: AuthCredentials,
  config: ConfigurationOptions ): Driver;

declare type types = {
  Node,
  Relationship,
  UnboundRelationship,
  PathSegment,
  Path,
  Result,
  ResultSummary,
  Record
  };

declare type session = {
  READ,
  WRITE
};

declare type error = {
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED
};
declare type integer = {
  toNumber,
  toString,
  inSafeRange
};

declare type forExport = {
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

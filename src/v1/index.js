/**
 * Copyright (c) 2002-2017 "Neo Technology,","
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {int, isInt, inSafeRange, toNumber, toString} from './integer';
import {Node, Relationship, UnboundRelationship, PathSegment, Path} from './graph-types'
import {Neo4jError, SERVICE_UNAVAILABLE, SESSION_EXPIRED, PROTOCOL_ERROR} from './error';
import Result from './result';
import ResultSummary from './result-summary';
import Record from './record';
import {Driver, READ, WRITE} from './driver';
import RoutingDriver from './routing-driver';
import VERSION from '../version';
import {parseScheme, parseUrl} from "./internal/connector";
import {assertString} from "./internal/util";


const auth ={
  basic: (username, password, realm = undefined) => {
    if (realm) {
      return {scheme: "basic", principal: username, credentials: password, realm: realm};
    } else {
      return {scheme: "basic", principal: username, credentials: password};
    }
  },
    custom: (principal, credentials, realm, scheme, parameters = undefined ) => {
    if (parameters) {
      return  {scheme: scheme, principal: principal, credentials: credentials, realm: realm,
        parameters: parameters}
    } else {
      return  {scheme: scheme, principal: principal, credentials: credentials, realm: realm}
    }
  }
};
let USER_AGENT = "neo4j-javascript/" + VERSION;

/**
 * Construct a new Neo4j Driver. This is your main entry point for this
 * library.
 *
 * ## Configuration
 *
 * This function optionally takes a configuration argument. Available configuration
 * options are as follows:
 *
 *     {
 *       // Encryption level: ENCRYPTION_ON or ENCRYPTION_OFF.
 *       encrypted: ENCRYPTION_ON|ENCRYPTION_OFF
 *
 *       // Trust strategy to use if encryption is enabled. There is no mode to disable
 *       // trust other than disabling encryption altogether. The reason for
 *       // this is that if you don't know who you are talking to, it is easy for an
 *       // attacker to hijack your encrypted connection, rendering encryption pointless.
 *       //
 *       // TRUST_ALL_CERTIFICATES is the default choice for NodeJS deployments. It only requires
 *       // new host to provide a certificate and does no verification of the provided certificate.
 *       //
 *       // TRUST_ON_FIRST_USE is available for modern NodeJS deployments, and works
 *       // similarly to how `ssl` works - the first time we connect to a new host,
 *       // we remember the certificate they use. If the certificate ever changes, we
 *       // assume it is an attempt to hijack the connection and require manual intervention.
 *       // This means that by default, connections "just work" while still giving you
 *       // good encrypted protection.
 *       //
 *       // TRUST_CUSTOM_CA_SIGNED_CERTIFICATES is the classic approach to trust verification -
 *       // whenever we establish an encrypted connection, we ensure the host is using
 *       // an encryption certificate that is in, or is signed by, a certificate listed
 *       // as trusted. In the web bundle, this list of trusted certificates is maintained
 *       // by the web browser. In NodeJS, you configure the list with the next config option.
 *       //
 *       // TRUST_SYSTEM_CA_SIGNED_CERTIFICATES meand that you trust whatever certificates
 *       // are in the default certificate chain of th
 *       trust: "TRUST_ALL_CERTIFICATES" | "TRUST_ON_FIRST_USE" | "TRUST_SIGNED_CERTIFICATES" |
  *       "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES" | "TRUST_SYSTEM_CA_SIGNED_CERTIFICATES",
 *
 *       // List of one or more paths to trusted encryption certificates. This only
 *       // works in the NodeJS bundle, and only matters if you use "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES".
 *       // The certificate files should be in regular X.509 PEM format.
 *       // For instance, ['./trusted.pem']
 *       trustedCertificates: [],
 *
 *       // Path to a file where the driver saves hosts it has seen in the past, this is
 *       // very similar to the ssl tool's known_hosts file. Each time we connect to a
 *       // new host, a hash of their certificate is stored along with the domain name and
 *       // port, and this is then used to verify the host certificate does not change.
 *       // This setting has no effect unless TRUST_ON_FIRST_USE is enabled.
 *       knownHosts:"~/.neo4j/known_hosts",
 *
 *       // The max number of connections that are allowed idle in the pool at any time.
 *       // Connection will be destroyed if this threshold is exceeded.
 *       connectionPoolSize: 50,
 *
 *       // Specify the maximum time in milliseconds transactions are allowed to retry via
 *       // {@link Session#readTransaction()} and {@link Session#writeTransaction()} functions. These functions
 *       // will retry the given unit of work on `ServiceUnavailable`, `SessionExpired` and transient errors with
 *       // exponential backoff using initial delay of 1 second. Default value is 30000 which is 30 seconds.
 *       maxTransactionRetryTime: 30000,
 *     }
 *
 * @param {string} url The URL for the Neo4j database, for instance "bolt://localhost"
 * @param {Map<String,String>} authToken Authentication credentials. See {@link auth} for helpers.
 * @param {Object} config Configuration object. See the configuration section above for details.
 * @returns {Driver}
 */
function driver(url, authToken, config = {}) {
  assertString(url, 'Bolt URL');
  const scheme = parseScheme(url);
  if (scheme === "bolt+routing://") {
    return new RoutingDriver(parseUrl(url), USER_AGENT, authToken, config);
  } else if (scheme === "bolt://") {
    return new Driver(parseUrl(url), USER_AGENT, authToken, config);
  } else {
    throw new Error("Unknown scheme: " + scheme);

  }
}


const types ={
  Node,
  Relationship,
  UnboundRelationship,
  PathSegment,
  Path,
  Result,
  ResultSummary,
  Record
  };

const session = {
  READ,
  WRITE
};
const error = {
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED,
  PROTOCOL_ERROR
};
const integer = {
  toNumber,
  toString,
  inSafeRange
};

const forExport = {
  driver,
  int,
  isInt,
  integer,
  Neo4jError,
  auth,
  types,
  session,
  error
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
  error
}
export default forExport

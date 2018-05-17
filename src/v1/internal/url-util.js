/**
 * Copyright (c) 2002-2018 "Neo4j,"
 * Neo4j Sweden AB [http://neo4j.com]
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

import {parse as uriJsParse} from 'uri-js';
import {assertString} from './util';

const DEFAULT_BOLT_PORT = 7687;
const DEFAULT_HTTP_PORT = 7474;
const DEFAULT_HTTPS_PORT = 7473;

class Url {

  constructor(scheme, host, port, hostAndPort, query) {
    /**
     * Nullable scheme (protocol) of the URL.
     * Example: 'bolt', 'bolt+routing', 'http', 'https', etc.
     * @type {string}
     */
    this.scheme = scheme;

    /**
     * Nonnull host name or IP address. IPv6 not wrapped in square brackets.
     * Example: 'neo4j.com', 'localhost', '127.0.0.1', '192.168.10.15', '::1', '2001:4860:4860::8844', etc.
     * @type {string}
     */
    this.host = host;

    /**
     * Nonnull number representing port. Default port for the given scheme is used if given URL string
     * does not contain port. Example: 7687 for bolt, 7474 for HTTP and 7473 for HTTPS.
     * @type {number}
     */
    this.port = port;

    /**
     * Nonnull host name or IP address plus port, separated by ':'. IPv6 wrapped in square brackets.
     * Example: 'neo4j.com', 'neo4j.com:7687', '127.0.0.1', '127.0.0.1:8080', '[2001:4860:4860::8844]',
     * '[2001:4860:4860::8844]:9090', etc.
     * @type {string}
     */
    this.hostAndPort = hostAndPort;

    /**
     * Nonnull object representing parsed query string key-value pairs. Duplicated keys not supported.
     * Example: '{}', '{'key1': 'value1', 'key2': 'value2'}', etc.
     * @type {object}
     */
    this.query = query;
  }
}

function parseDatabaseUrl(url) {
  assertString(url, 'URL');

  const sanitized = sanitizeUrl(url);
  const parsedUrl = uriJsParse(sanitized.url);

  const scheme = sanitized.schemeMissing ? null : extractScheme(parsedUrl.scheme);
  const host = extractHost(parsedUrl.host); // no square brackets for IPv6
  const formattedHost = formatHost(host); // has square brackets for IPv6
  const port = extractPort(parsedUrl.port, scheme);
  const hostAndPort = `${formattedHost}:${port}`;
  const query = extractQuery(parsedUrl.query, url);

  return new Url(scheme, host, port, hostAndPort, query);
}

function sanitizeUrl(url) {
  url = url.trim();

  if (url.indexOf('://') === -1) {
    // url does not contain scheme, add dummy 'none://' to make parser work correctly
    return {schemeMissing: true, url: `none://${url}`};
  }

  return {schemeMissing: false, url: url};
}

function extractScheme(scheme) {
  if (scheme) {
    scheme = scheme.trim();
    if (scheme.charAt(scheme.length - 1) === ':') {
      scheme = scheme.substring(0, scheme.length - 1);
    }
    return scheme;
  }
  return null;
}

function extractHost(host, url) {
  if (!host) {
    throw new Error(`Unable to extract host from ${url}`);
  }
  return host.trim();
}

function extractPort(portString, scheme) {
  const port = parseInt(portString, 10);
  return (port === 0 || port) ? port : defaultPortForScheme(scheme);
}

function extractQuery(queryString, url) {
  const query = trimAndSanitizeQuery(queryString);
  const context = {};

  if (query) {
    query.split('&').forEach(pair => {
      const keyValue = pair.split('=');
      if (keyValue.length !== 2) {
        throw new Error(`Invalid parameters: '${keyValue}' in URL '${url}'.`);
      }

      const key = trimAndVerifyQueryElement(keyValue[0], 'key', url);
      const value = trimAndVerifyQueryElement(keyValue[1], 'value', url);

      if (context[key]) {
        throw new Error(`Duplicated query parameters with key '${key}' in URL '${url}'`);
      }

      context[key] = value;
    });
  }

  return context;
}

function trimAndSanitizeQuery(query) {
  query = (query || '').trim();
  if (query && query.charAt(0) === '?') {
    query = query.substring(1, query.length);
  }
  return query;
}

function trimAndVerifyQueryElement(element, name, url) {
  element = (element || '').trim();
  if (!element) {
    throw new Error(`Illegal empty ${name} in URL query '${url}'`);
  }
  return element;
}

function escapeIPv6Address(address) {
  const startsWithSquareBracket = address.charAt(0) === '[';
  const endsWithSquareBracket = address.charAt(address.length - 1) === ']';

  if (!startsWithSquareBracket && !endsWithSquareBracket) {
    return `[${address}]`;
  } else if (startsWithSquareBracket && endsWithSquareBracket) {
    return address;
  } else {
    throw new Error(`Illegal IPv6 address ${address}`);
  }
}

function formatHost(host) {
  if (!host) {
    throw new Error(`Illegal host ${host}`);
  }
  const isIPv6Address = host.indexOf(':') >= 0;
  return isIPv6Address ? escapeIPv6Address(host) : host;
}

function formatIPv4Address(address, port) {
  return `${address}:${port}`;
}

function formatIPv6Address(address, port) {
  const escapedAddress = escapeIPv6Address(address);
  return `${escapedAddress}:${port}`;
}

function defaultPortForScheme(scheme) {
  if (scheme === 'http') {
    return DEFAULT_HTTP_PORT;
  } else if (scheme === 'https') {
    return DEFAULT_HTTPS_PORT;
  } else {
    return DEFAULT_BOLT_PORT;
  }
}

export default {
  parseDatabaseUrl: parseDatabaseUrl,
  defaultPortForScheme: defaultPortForScheme,
  formatIPv4Address: formatIPv4Address,
  formatIPv6Address: formatIPv6Address
};

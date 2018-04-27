/**
 * Copyright (c) 2002-2018 Neo4j Sweden AB [http://neo4j.com]
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

import ParsedUrl from 'url-parse';
import {assertString} from './util';
import {DEFAULT_PORT} from './ch-config';

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
     * Nonnull number representing port. Default port {@link DEFAULT_PORT} value is used if given URL string
     * does not contain port. Example: 7687, 12000, etc.
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

function parseBoltUrl(url) {
  assertString(url, 'URL');

  const sanitized = sanitizeUrl(url);
  const parsedUrl = new ParsedUrl(sanitized.url, {}, query => extractQuery(query, url));

  const scheme = sanitized.schemeMissing ? null : extractScheme(parsedUrl.protocol);
  const rawHost = extractHost(parsedUrl.hostname); // has square brackets for IPv6
  const host = unescapeIPv6Address(rawHost); // no square brackets for IPv6
  const port = extractPort(parsedUrl.port);
  const hostAndPort = `${rawHost}:${port}`;
  const query = parsedUrl.query;

  return new Url(scheme, host, port, hostAndPort, query);
}

function sanitizeUrl(url) {
  url = url.trim();

  if (url.indexOf('://') === -1) {
    // url does not contain scheme, add dummy 'http://' to make parser work correctly
    return {schemeMissing: true, url: `http://${url}`};
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

function extractPort(portString) {
  const port = parseInt(portString, 10);
  return (port === 0 || port) ? port : DEFAULT_PORT;
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

function unescapeIPv6Address(address) {
  const startsWithSquareBracket = address.charAt(0) === '[';
  const endsWithSquareBracket = address.charAt(address.length - 1) === ']';

  if (!startsWithSquareBracket && !endsWithSquareBracket) {
    return address;
  } else if (startsWithSquareBracket && endsWithSquareBracket) {
    return address.substring(1, address.length - 1);
  } else {
    throw new Error(`Illegal IPv6 address ${address}`);
  }
}

function formatIPv4Address(address, port) {
  return `${address}:${port}`;
}

function formatIPv6Address(address, port) {
  const escapedAddress = escapeIPv6Address(address);
  return `${escapedAddress}:${port}`;
}

export default {
  parseBoltUrl: parseBoltUrl,
  formatIPv4Address: formatIPv4Address,
  formatIPv6Address: formatIPv6Address
};

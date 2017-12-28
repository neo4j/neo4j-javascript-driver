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

import ParsedUrl from 'url-parse';

class Url {

  constructor(scheme, host, port, query) {
    /**
     * Nullable scheme (protocol) of the URL.
     * @type {string}
     */
    this.scheme = scheme;

    /**
     * Nonnull host name or IP address. IPv6 always wrapped in square brackets.
     * @type {string}
     */
    this.host = host;

    /**
     * Nullable number representing port.
     * @type {number}
     */
    this.port = port;

    /**
     * Nonnull host name or IP address plus port, separated by ':'.
     * @type {string}
     */
    this.hostAndPort = port ? `${host}:${port}` : host;

    /**
     * Nonnull object representing parsed query string key-value pairs. Duplicated keys not supported.
     * @type {object}
     */
    this.query = query;
  }
}

function parse(url) {
  const sanitized = sanitizeUrl(url);
  const parsedUrl = new ParsedUrl(sanitized.url, {}, query => extractQuery(query, url));

  const scheme = sanitized.schemeMissing ? null : extractScheme(parsedUrl.protocol);
  const host = extractHost(parsedUrl.hostname);
  const port = extractPort(parsedUrl.port);
  const query = parsedUrl.query;

  return new Url(scheme, host, port, query);
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
  return port ? port : null;
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

export default {
  parse: parse
};

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
     * Nonnull object representing parsed query string key-value pairs. Duplicated keys not supported.
     * @type {object}
     */
    this.query = query;
  }
}

class UrlParser {

  parse(url) {
    throw new Error('Abstract function');
  }
}

class NodeUrlParser extends UrlParser {

  constructor() {
    super();
    this._url = require('url');
  }

  static isAvailable() {
    try {
      const parseFunction = require('url').parse;
      if (parseFunction && typeof parseFunction === 'function') {
        return true;
      }
    } catch (e) {
    }
    return false;
  }

  parse(url) {
    url = url.trim();

    let schemeMissing = false;
    if (url.indexOf('://') === -1) {
      // url does not contain scheme, add dummy 'http://' to make parser work correctly
      schemeMissing = true;
      url = `http://${url}`;
    }

    const parsed = this._url.parse(url);

    const scheme = schemeMissing ? null : NodeUrlParser.extractScheme(parsed);
    const host = NodeUrlParser.extractHost(url, parsed);
    const port = extractPort(parsed.port);
    const query = extractQuery(parsed.search, url);

    return new Url(scheme, host, port, query);
  }

  static extractScheme(parsedUrl) {
    try {
      const protocol = parsedUrl.protocol; // results in scheme with ':', like 'bolt:', 'http:'...
      return protocol.substring(0, protocol.length - 1); // remove the trailing ':'
    } catch (e) {
      return null;
    }
  }

  static extractHost(originalUrl, parsedUrl) {
    const hostname = parsedUrl.hostname; // results in host name or IP address, square brackets removed for IPv6
    const host = parsedUrl.host || ''; // results in hostname + port, like: 'localhost:7687', '[::1]:7687',...; includes square brackets for IPv6

    if (!hostname) {
      throw new Error(`Unable to parse host name in ${originalUrl}`);
    }

    if (!startsWith(hostname, '[') && startsWith(host, '[')) {
      // looks like an IPv6 address, add square brackets to the host name
      return `[${hostname}]`;
    }
    return hostname;
  }
}

class BrowserUrlParser extends UrlParser {

  constructor() {
    super();
  }

  static isAvailable() {
    return document && typeof document === 'object';
  }


  parse(url) {
    const urlAndScheme = BrowserUrlParser.sanitizeUrlAndExtractScheme(url);

    url = urlAndScheme.url;

    const parsed = document.createElement('a');
    parsed.href = url;

    const scheme = urlAndScheme.scheme;
    const host = BrowserUrlParser.extractHost(url, parsed);
    const port = extractPort(parsed.port);
    const query = extractQuery(parsed.search, url);

    return new Url(scheme, host, port, query);
  }

  static sanitizeUrlAndExtractScheme(url) {
    url = url.trim();

    let schemeMissing = false;
    if (url.indexOf('://') === -1) {
      // url does not contain scheme, add dummy 'http://' to make parser work correctly
      schemeMissing = true;
      url = `http://${url}`;
    }

    const schemeAndRestSplit = url.split('://');
    if (schemeAndRestSplit.length !== 2) {
      throw new Error(`Unable to extract scheme from ${url}`);
    }

    const splitScheme = schemeAndRestSplit[0];
    const splitRest = schemeAndRestSplit[1];

    if (!splitScheme) {
      // url probably looks like '://localhost:7687', add dummy 'http://' to make parser work correctly
      schemeMissing = true;
      url = `http://${url}`;
    } else if (splitScheme !== 'http') {
      // parser does not seem to work with schemes other than 'http' and 'https', add dummy 'http'
      url = `http://${splitRest}`;
    }

    const scheme = schemeMissing ? null : splitScheme;
    return {scheme: scheme, url: url};
  }

  static extractHost(originalUrl, parsedUrl) {
    const hostname = parsedUrl.hostname; // results in host name or IP address, IPv6 address always in square brackets
    if (!hostname) {
      throw new Error(`Unable to parse host name in ${originalUrl}`);
    }
    return hostname;
  }
}

function extractPort(portString) {
  try {
    const port = parseInt(portString, 10);
    if (port) {
      return port;
    }
  } catch (e) {
  }
  return null;
}

function extractQuery(queryString, url) {
  const query = trimAndSanitizeQueryString(queryString);
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

function trimAndSanitizeQueryString(queryString) {
  if (queryString) {
    queryString = queryString.trim();
    if (startsWith(queryString, '?')) {
      queryString = queryString.substring(1, queryString.length);
    }
  }
  return queryString;
}

function trimAndVerifyQueryElement(string, name, url) {
  const result = string.trim();
  if (!result) {
    throw new Error(`Illegal empty ${name} in URL query '${url}'`);
  }
  return result;
}

function createParser() {
  if (NodeUrlParser.isAvailable()) {
    return new NodeUrlParser();
  } else if (BrowserUrlParser.isAvailable()) {
    return new BrowserUrlParser();
  } else {
    throw new Error('Unable to create a URL parser, neither NodeJS nor Browser version is available');
  }
}

function startsWith(string, prefix) {
  return string.lastIndexOf(prefix, 0) === 0;
}

const parser = createParser();

export default parser;

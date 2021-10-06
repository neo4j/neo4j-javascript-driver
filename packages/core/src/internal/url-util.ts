/**
 * Copyright (c) "Neo4j"
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

import { assertString } from './util'

const DEFAULT_BOLT_PORT = 7687
const DEFAULT_HTTP_PORT = 7474
const DEFAULT_HTTPS_PORT = 7473

class Url {
  readonly scheme: string | null
  readonly host: string
  readonly port: number
  readonly hostAndPort: string
  readonly query: Object

  constructor(
    scheme: string | null,
    host: string,
    port: number,
    hostAndPort: string,
    query: Object
  ) {
    /**
     * Nullable scheme (protocol) of the URL.
     * Example: 'bolt', 'neo4j', 'http', 'https', etc.
     * @type {string}
     */
    this.scheme = scheme

    /**
     * Nonnull host name or IP address. IPv6 not wrapped in square brackets.
     * Example: 'neo4j.com', 'localhost', '127.0.0.1', '192.168.10.15', '::1', '2001:4860:4860::8844', etc.
     * @type {string}
     */
    this.host = host

    /**
     * Nonnull number representing port. Default port for the given scheme is used if given URL string
     * does not contain port. Example: 7687 for bolt, 7474 for HTTP and 7473 for HTTPS.
     * @type {number}
     */
    this.port = port

    /**
     * Nonnull host name or IP address plus port, separated by ':'. IPv6 wrapped in square brackets.
     * Example: 'neo4j.com', 'neo4j.com:7687', '127.0.0.1', '127.0.0.1:8080', '[2001:4860:4860::8844]',
     * '[2001:4860:4860::8844]:9090', etc.
     * @type {string}
     */
    this.hostAndPort = hostAndPort

    /**
     * Nonnull object representing parsed query string key-value pairs. Duplicated keys not supported.
     * Example: '{}', '{'key1': 'value1', 'key2': 'value2'}', etc.
     * @type {Object}
     */
    this.query = query
  }
}

interface ParsedUri {
  scheme?: string
  host?: string
  port?: number | string
  query?: string
  fragment?: string
  userInfo?: string
  authority?: string
  path?: string
}

function parseDatabaseUrl(url: string) {
  assertString(url, 'URL')

  const sanitized = sanitizeUrl(url)
  const parsedUrl = uriJsParse(sanitized.url)

  const scheme = sanitized.schemeMissing
    ? null
    : extractScheme(parsedUrl.scheme)
  const host = extractHost(parsedUrl.host) // no square brackets for IPv6
  const formattedHost = formatHost(host) // has square brackets for IPv6
  const port = extractPort(parsedUrl.port, scheme)
  const hostAndPort = `${formattedHost}:${port}`
  const query = extractQuery(
    // @ts-ignore
    parsedUrl.query || extractResourceQueryString(parsedUrl.resourceName),
    url
  )

  return new Url(scheme, host, port, hostAndPort, query)
}

function extractResourceQueryString(resource?: string): string | null {
  if (typeof resource !== 'string') {
    return null
  }
  const [_, query] = resource.split('?')
  return query
}

function sanitizeUrl(url: string): { schemeMissing: boolean; url: string } {
  url = url.trim()

  if (url.indexOf('://') === -1) {
    // url does not contain scheme, add dummy 'none://' to make parser work correctly
    return { schemeMissing: true, url: `none://${url}` }
  }

  return { schemeMissing: false, url: url }
}

function extractScheme(scheme?: string): string | null {
  if (scheme) {
    scheme = scheme.trim()
    if (scheme.charAt(scheme.length - 1) === ':') {
      scheme = scheme.substring(0, scheme.length - 1)
    }
    return scheme
  }
  return null
}

function extractHost(host?: string, url?: string): string {
  if (!host) {
    throw new Error(`Unable to extract host from ${url}`)
  }
  return host.trim()
}

function extractPort(
  portString: string | number | undefined,
  scheme: string | null
): number {
  const port =
    typeof portString === 'string' ? parseInt(portString, 10) : portString
  return port === 0 || port ? port : defaultPortForScheme(scheme)
}

function extractQuery(
  queryString: string | undefined | null,
  url: string
): Object {
  const query = queryString ? trimAndSanitizeQuery(queryString) : null
  const context: any = {}

  if (query) {
    query.split('&').forEach((pair: string) => {
      const keyValue = pair.split('=')
      if (keyValue.length !== 2) {
        throw new Error(`Invalid parameters: '${keyValue}' in URL '${url}'.`)
      }

      const key = trimAndVerifyQueryElement(keyValue[0], 'key', url)
      const value = trimAndVerifyQueryElement(keyValue[1], 'value', url)

      if (context[key]) {
        throw new Error(
          `Duplicated query parameters with key '${key}' in URL '${url}'`
        )
      }

      context[key] = value
    })
  }

  return context
}

function trimAndSanitizeQuery(query: string): string {
  query = (query || '').trim()
  if (query && query.charAt(0) === '?') {
    query = query.substring(1, query.length)
  }
  return query
}

function trimAndVerifyQueryElement(element: string, name: string, url: string) {
  element = (element || '').trim()
  if (!element) {
    throw new Error(`Illegal empty ${name} in URL query '${url}'`)
  }
  return element
}

function escapeIPv6Address(address: string) {
  const startsWithSquareBracket = address.charAt(0) === '['
  const endsWithSquareBracket = address.charAt(address.length - 1) === ']'

  if (!startsWithSquareBracket && !endsWithSquareBracket) {
    return `[${address}]`
  } else if (startsWithSquareBracket && endsWithSquareBracket) {
    return address
  } else {
    throw new Error(`Illegal IPv6 address ${address}`)
  }
}

function formatHost(host: string) {
  if (!host) {
    throw new Error(`Illegal host ${host}`)
  }
  const isIPv6Address = host.indexOf(':') >= 0
  return isIPv6Address ? escapeIPv6Address(host) : host
}

function formatIPv4Address(address: string, port: number): string {
  return `${address}:${port}`
}

function formatIPv6Address(address: string, port: number): string {
  const escapedAddress = escapeIPv6Address(address)
  return `${escapedAddress}:${port}`
}

function defaultPortForScheme(scheme: string | null): number {
  if (scheme === 'http') {
    return DEFAULT_HTTP_PORT
  } else if (scheme === 'https') {
    return DEFAULT_HTTPS_PORT
  } else {
    return DEFAULT_BOLT_PORT
  }
}

function uriJsParse(value: string) {
  // JS version of Python partition function
  function partition(s: string, delimiter: string): [string, string, string] {
    const i = s.indexOf(delimiter)
    if (i >= 0) return [s.substring(0, i), s[i], s.substring(i + 1)]
    else return [s, '', '']
  }

  // JS version of Python rpartition function
  function rpartition(s: string, delimiter: string): [string, string, string] {
    const i = s.lastIndexOf(delimiter)
    if (i >= 0) return [s.substring(0, i), s[i], s.substring(i + 1)]
    else return ['', '', s]
  }

  function between(
    s: string,
    ldelimiter: string,
    rdelimiter: string
  ): [string, string] {
    const lpartition = partition(s, ldelimiter)
    const rpartition = partition(lpartition[2], rdelimiter)
    return [rpartition[0], rpartition[2]]
  }

  // Parse an authority string into an object
  // with the following keys:
  // - userInfo (optional, might contain both user name and password)
  // - host
  // - port (optional, included only as a string)
  function parseAuthority(value: string): ParsedUri {
    let parsed: ParsedUri = {},
      parts: [string, string, string]

    // Parse user info
    parts = rpartition(value, '@')
    if (parts[1] === '@') {
      parsed.userInfo = decodeURIComponent(parts[0])
      value = parts[2]
    }

    // Parse host and port
    const [ipv6Host, rest] = between(value, `[`, `]`)
    if (ipv6Host !== '') {
      parsed.host = ipv6Host
      parts = partition(rest, ':')
    } else {
      parts = partition(value, ':')
      parsed.host = parts[0]
    }

    if (parts[1] === ':') {
      parsed.port = parts[2]
    }

    return parsed
  }

  let parsed: ParsedUri = {},
    parts: string[]

  // Parse scheme
  parts = partition(value, ':')
  if (parts[1] === ':') {
    parsed.scheme = decodeURIComponent(parts[0])
    value = parts[2]
  }

  // Parse fragment
  parts = partition(value, '#')
  if (parts[1] === '#') {
    parsed.fragment = decodeURIComponent(parts[2])
    value = parts[0]
  }

  // Parse query
  parts = partition(value, '?')
  if (parts[1] === '?') {
    parsed.query = parts[2]
    value = parts[0]
  }

  // Parse authority and path
  if (value.startsWith('//')) {
    parts = partition(value.substr(2), '/')
    parsed = { ...parsed, ...parseAuthority(parts[0]) }
    parsed.path = parts[1] + parts[2]
  } else {
    parsed.path = value
  }

  return parsed
}

export {
  parseDatabaseUrl,
  defaultPortForScheme,
  formatIPv4Address,
  formatIPv6Address,
  Url
}

/**
 * Copyright (c) 2002-2018 "Neo Technology,"
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

import ChannelConfig from '../../src/v1/internal/ch-config';
import hasFeature from '../../src/v1/internal/features';
import {SERVICE_UNAVAILABLE} from '../../src/v1/error';

describe('ChannelConfig', () => {

  it('should respect given host', () => {
    const host = 'neo4j.com';

    const config = new ChannelConfig(host, 42, {}, '');

    expect(config.host).toEqual(host);
  });

  it('should respect given port', () => {
    const port = 4242;

    const config = new ChannelConfig('', port, {}, '');

    expect(config.port).toEqual(port);
  });

  it('should respect given encrypted conf', () => {
    const encrypted = 'ENCRYPTION_ON';

    const config = new ChannelConfig('', 42, {encrypted: encrypted}, '');

    expect(config.encrypted).toEqual(encrypted);
  });

  it('should respect given trust conf', () => {
    const trust = 'TRUST_ALL_CERTIFICATES';

    const config = new ChannelConfig('', 42, {trust: trust}, '');

    expect(config.trust).toEqual(trust);
  });

  it('should respect given trusted certificates conf', () => {
    const trustedCertificates = ['./foo.pem', './bar.pem', './baz.pem'];

    const config = new ChannelConfig('', 42, {trustedCertificates: trustedCertificates}, '');

    expect(config.trustedCertificates).toEqual(trustedCertificates);
  });

  it('should respect given known hosts', () => {
    const knownHostsPath = '~/.neo4j/known_hosts';

    const config = new ChannelConfig('', 42, {knownHosts: knownHostsPath}, '');

    expect(config.knownHostsPath).toEqual(knownHostsPath);
  });

  it('should respect given connection error code', () => {
    const connectionErrorCode = 'ConnectionFailed';

    const config = new ChannelConfig('', 42, {}, connectionErrorCode);

    expect(config.connectionErrorCode).toEqual(connectionErrorCode);
  });

  it('should use encryption if available but not configured', () => {
    const config = new ChannelConfig('', 42, {}, '');

    expect(config.encrypted).toEqual(hasFeature('trust_all_certificates'));
  });

  it('should use available trust conf when nothing configured', () => {
    const config = new ChannelConfig('', 42, {}, '');

    const availableTrust = hasFeature('trust_all_certificates') ? 'TRUST_ALL_CERTIFICATES' : 'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES';
    expect(config.trust).toEqual(availableTrust);
  });

  it('should have no trusted certificates when not configured', () => {
    const config = new ChannelConfig('', 42, {}, '');

    expect(config.trustedCertificates).toEqual([]);
  });

  it('should have null known hosts path when not configured', () => {
    const config = new ChannelConfig('', 42, {}, '');

    expect(config.knownHostsPath).toBeNull();
  });

  it('should have service unavailable as default error code', () => {
    const config = new ChannelConfig('', 42, {}, '');

    expect(config.connectionErrorCode).toEqual(SERVICE_UNAVAILABLE);
  });

});

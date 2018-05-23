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

import ChannelConfig from '../../src/v1/internal/ch-config';
import urlUtil from '../../src/v1/internal/url-util';
import hasFeature from '../../src/v1/internal/features';
import {SERVICE_UNAVAILABLE} from '../../src/v1/error';

describe('ChannelConfig', () => {

  it('should respect given Url', () => {
    const url = urlUtil.parseDatabaseUrl('bolt://neo4j.com:4242');

    const config = new ChannelConfig(url, {}, '');

    expect(config.url.scheme).toEqual('bolt');
    expect(config.url.host).toEqual('neo4j.com');
    expect(config.url.port).toEqual(4242);
  });

  it('should respect given encrypted conf', () => {
    const encrypted = 'ENCRYPTION_ON';

    const config = new ChannelConfig(null, {encrypted: encrypted}, '');

    expect(config.encrypted).toEqual(encrypted);
  });

  it('should respect given trust conf', () => {
    const trust = 'TRUST_ALL_CERTIFICATES';

    const config = new ChannelConfig(null, {trust: trust}, '');

    expect(config.trust).toEqual(trust);
  });

  it('should respect given trusted certificates conf', () => {
    const trustedCertificates = ['./foo.pem', './bar.pem', './baz.pem'];

    const config = new ChannelConfig(null, {trustedCertificates: trustedCertificates}, '');

    expect(config.trustedCertificates).toEqual(trustedCertificates);
  });

  it('should respect given known hosts', () => {
    const knownHostsPath = '~/.neo4j/known_hosts';

    const config = new ChannelConfig(null, {knownHosts: knownHostsPath}, '');

    expect(config.knownHostsPath).toEqual(knownHostsPath);
  });

  it('should respect given connection error code', () => {
    const connectionErrorCode = 'ConnectionFailed';

    const config = new ChannelConfig(null, {}, connectionErrorCode);

    expect(config.connectionErrorCode).toEqual(connectionErrorCode);
  });

  it('should use encryption if available but not configured', () => {
    const config = new ChannelConfig(null, {}, '');

    if (hasFeature('trust_all_certificates')) {
      expect(config.encrypted).toBeTruthy();
    } else {
      expect(config.encrypted).toBeFalsy();
    }
  });

  it('should use available trust conf when nothing configured', () => {
    const config = new ChannelConfig(null, {}, '');

    const availableTrust = hasFeature('trust_all_certificates') ? 'TRUST_ALL_CERTIFICATES' : 'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES';
    expect(config.trust).toEqual(availableTrust);
  });

  it('should have no trusted certificates when not configured', () => {
    const config = new ChannelConfig(null, {}, '');

    expect(config.trustedCertificates).toEqual([]);
  });

  it('should have null known hosts path when not configured', () => {
    const config = new ChannelConfig(null, {}, '');

    expect(config.knownHostsPath).toBeNull();
  });

  it('should have service unavailable as default error code', () => {
    const config = new ChannelConfig(null, {}, '');

    expect(config.connectionErrorCode).toEqual(SERVICE_UNAVAILABLE);
  });

  it('should have connection timeout by default', () => {
    const config = new ChannelConfig(null, {}, '');

    expect(config.connectionTimeout).toEqual(5000);
  });

  it('should respect configured connection timeout', () => {
    const config = new ChannelConfig(null, {connectionTimeout: 424242}, '');

    expect(config.connectionTimeout).toEqual(424242);
  });

  it('should respect disabled connection timeout with value zero', () => {
    const config = new ChannelConfig(null, {connectionTimeout: 0}, '');

    expect(config.connectionTimeout).toBeNull();
  });

  it('should respect disabled connection timeout with negative value', () => {
    const config = new ChannelConfig(null, {connectionTimeout: -42}, '');

    expect(config.connectionTimeout).toBeNull();
  });

});

/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import ConnectionErrorHandler from '../../src/internal/connection-error-handler';
import {newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from '../../src/error';

describe('ConnectionErrorHandler', () => {

  it('should return error code', () => {
    const code = 'Neo4j.Error.Hello';
    const handler = new ConnectionErrorHandler(code);
    expect(code).toEqual(handler.errorCode());
  });

  it('should handle and transform availability errors', () => {
    const errors = [];
    const hostPorts = [];
    const transformedError = newError('Message', 'Code');
    const handler = new ConnectionErrorHandler(SERVICE_UNAVAILABLE, (error, hostPort) => {
      errors.push(error);
      hostPorts.push(hostPort);
      return transformedError;
    });

    const error1 = newError('A', SERVICE_UNAVAILABLE);
    const error2 = newError('B', SESSION_EXPIRED);
    const error3 = newError('C', 'Neo.TransientError.General.DatabaseUnavailable');

    [error1, error2, error3].forEach((error, idx) => {
      const newTransformedError = handler.handleAndTransformError(error, 'localhost:' + idx);
      expect(newTransformedError).toEqual(transformedError);
    });

    expect(errors).toEqual([error1, error2, error3]);
    expect(hostPorts).toEqual(['localhost:0', 'localhost:1', 'localhost:2']);
  });

  it('should handle and transform failure to write errors', () => {
    const errors = [];
    const hostPorts = [];
    const transformedError = newError('Message', 'Code');
    const handler = new ConnectionErrorHandler(SERVICE_UNAVAILABLE, null, (error, hostPort) => {
      errors.push(error);
      hostPorts.push(hostPort);
      return transformedError;
    });

    const error1 = newError('A', 'Neo.ClientError.Cluster.NotALeader');
    const error2 = newError('B', 'Neo.ClientError.General.ForbiddenOnReadOnlyDatabase');

    [error1, error2].forEach((error, idx) => {
      const newTransformedError = handler.handleAndTransformError(error, 'localhost:' + idx);
      expect(newTransformedError).toEqual(transformedError);
    });

    expect(errors).toEqual([error1, error2]);
    expect(hostPorts).toEqual(['localhost:0', 'localhost:1']);
  });

});

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

import RequestMessage from '../../src/v1/internal/request-message';

describe('RequestMessage', () => {

  it('should create INIT message', () => {
    const clientName = 'my-driver/1.0.2';
    const authToken = {username: 'neo4j', password: 'secret'};

    const message = RequestMessage.init(clientName, authToken);

    expect(message.signature).toEqual(0x01);
    expect(message.fields).toEqual([clientName, authToken]);
    expect(message.toString()).toEqual(`INIT ${clientName} {...}`);
  });

  it('should create RUN message', () => {
    const statement = 'RETURN $x';
    const parameters = {x: 42};

    const message = RequestMessage.run(statement, parameters);

    expect(message.signature).toEqual(0x10);
    expect(message.fields).toEqual([statement, parameters]);
    expect(message.toString()).toEqual(`RUN ${statement} ${JSON.stringify(parameters)}`);
  });

  it('should create PULL_ALL message', () => {
    const message = RequestMessage.pullAll();

    expect(message.signature).toEqual(0x3F);
    expect(message.fields).toEqual([]);
    expect(message.toString()).toEqual('PULL_ALL');
  });

  it('should create RESET message', () => {
    const message = RequestMessage.reset();

    expect(message.signature).toEqual(0x0F);
    expect(message.fields).toEqual([]);
    expect(message.toString()).toEqual('RESET');
  });
});

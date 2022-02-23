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
import {
  Result,
  Record,
  QueryResult,
  ResultSummary,
  AuthToken,
  Config,
  EncryptionLevel,
  TrustStrategy,
  SessionMode,
  Node,
  Relationship,
  UnboundRelationship,
  PathSegment,
  Path,
  int,
  Integer,
  ResultObserver,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Notification,
  NotificationPosition,
  ServerInfo,
  Session,
  Transaction,
  Driver,
  Point,
  Duration,
  LocalTime,
  Time,
  Date,
  LocalDateTime,
  DateTime
} from '../../'

describe('index', () => {
  it('should export an instanciable Result', () => {
    const result: Result = new Result(
      Promise.reject(Error('NO REASON')),
      'RETURN 1'
    )
    expect(result).toBeDefined()

    // Catch the error
    result.catch(() => {})
  })

  it('should export an instanciable Record', () => {
    const record: Record = new Record(['key'], [1])
    expect(record).toBeDefined()
  })

  it('should export QueryResult interface', () => {
    const queryResult: QueryResult = {
      records: [new Record(['key'], [1])],
      summary: new ResultSummary('RETURN 1', {}, {})
    }

    expect(queryResult).toBeDefined()
  })

  it('should export an instanciable ResultSummary', () => {
    const resultSummary: ResultSummary = new ResultSummary('RETURN 1', {}, {})

    expect(resultSummary).toBeDefined()
  })

  it('should export AuthToken', () => {
    const authToken: AuthToken = {
      scheme: 'basic',
      principal: 'user',
      credentials: 'password'
    }

    expect(authToken).toBeDefined()
  })

  it('should export Config', () => {
    const config: Config = {
      userAgent: 'user agent'
    }

    expect(config).toBeDefined()
  })

  it('should export EncryptionLevel', () => {
    const encryptionLevel: EncryptionLevel = 'ENCRYPTION_ON'

    expect(encryptionLevel).toBeDefined()
  })

  it('should export TrustStrategy', () => {
    const trustStrategy: TrustStrategy = 'TRUST_ALL_CERTIFICATES'

    expect(trustStrategy).toBeDefined()
  })

  it('should export SessionMode', () => {
    const sessionMode: SessionMode = 'READ'

    expect(sessionMode).toBeDefined()
  })

  it('should export an instanciable Node', () => {
    const node: Node = new Node(int(123), ['abc'], [1])
    expect(node).toBeDefined()
  })

  it('should export an instanciable Relationship', () => {
    const relationship: Relationship = new Relationship(
      int(123),
      int(1),
      int(1),
      'rel',
      {}
    )
    expect(relationship).toBeDefined()
  })

  it('should export an instanciable UnboundRelationship', () => {
    const relationship: UnboundRelationship = new UnboundRelationship(
      int(123),
      'rel',
      {}
    )
    expect(relationship).toBeDefined()
  })

  it('should export an instanciable PathSegment', () => {
    const pathSegment: PathSegment = new PathSegment(
      new Node(int(1), ['a'], ['1']),
      new Relationship(int(123), int(1), int(1), 'rel', {}),
      new Node(int(1), ['a'], ['1'])
    )
    expect(pathSegment).toBeDefined()
  })

  it('should export an instanciable Path', () => {
    const path: Path = new Path(
      new Node(int(1), ['a'], ['1']),
      new Node(int(1), ['a'], ['1']),
      []
    )
    expect(path).toBeDefined()
  })

  it('should export an instanciable Integer', () => {
    const integer: Integer = new Integer()
    expect(integer).toBeDefined()
  })

  it('should export ResultObserver', () => {
    const resultObserver: ResultObserver = {
      onCompleted: (summary: ResultSummary) => {}
    }
    expect(resultObserver).toBeDefined()
  })

  it('should export an instanciable Plan', () => {
    const plan: Plan = new Plan({})
    expect(plan).toBeDefined()
  })

  it('should export an instanciable ProfilePlan', () => {
    const profilePlan: ProfiledPlan = new ProfiledPlan({})
    expect(profilePlan).toBeDefined()
  })

  it('should export an instanciable QueryStatistics', () => {
    const queryStatistics: QueryStatistics = new QueryStatistics({})
    expect(queryStatistics).toBeDefined()
  })

  it('should export an instanciable Notification', () => {
    const notification: Notification = new Notification({})
    expect(notification).toBeDefined()
  })

  it('should export NotificationPosition', () => {
    const notification: NotificationPosition = {
      offset: 1,
      column: 2,
      line: 3
    }
    expect(notification).toBeDefined()
  })

  it('should export an instanciable ServerInfo', () => {
    const serverInfo: ServerInfo = new ServerInfo({})
    expect(serverInfo).toBeDefined()
  })

  it('should export an instanciable Session', () => {
    const session: Session = new Session({
      config: {},
      database: 'system',
      fetchSize: 123,
      mode: 'READ',
      reactive: false,
      connectionProvider: {
        acquireConnection: () => Promise.reject(Error('something wrong')),
        close: () => Promise.resolve(),
        supportsMultiDb: () => Promise.resolve(true),
        supportsTransactionConfig: () => Promise.resolve(true),
        supportsUserImpersonation: () => Promise.resolve(true)
      }
    })
    expect(session).toBeDefined()
  })

  it('should export Transaction', () => {
    const transaction: Transaction | undefined = undefined

    expect(transaction).not.toBeDefined()
  })

  it('should export Driver', () => {
    const driver: Driver | undefined = undefined

    expect(driver).not.toBeDefined()
  })

  it('should export an instanciable Point', () => {
    const point: Point = new Point(int(1), 2, 3)
    expect(point).toBeDefined()
  })

  it('should export an instanciable Duration', () => {
    const duration: Duration<number> = new Duration(1, 2, 3, 4)
    expect(duration).toBeDefined()
  })

  it('should export an instanciable Point', () => {
    const localTime: LocalTime<number> = new LocalTime(1, 2, 3, 3)
    expect(localTime).toBeDefined()
  })

  it('should export an instanciable Time', () => {
    const time: Time<number> = new Time(1, 2, 3, 4, 5)
    expect(time).toBeDefined()
  })

  it('should export an instanciable Date', () => {
    const date: Date<number> = new Date(1, 2, 3)
    expect(date).toBeDefined()
  })

  it('should export an instanciable LocalDateTime', () => {
    const date: LocalDateTime<number> = new LocalDateTime(1, 2, 3, 1, 4, 5, 6)
    expect(date).toBeDefined()
  })

  it('should export an instanciable DateTime', () => {
    const date: DateTime<number> = new DateTime(1, 2, 3, 3, 5, 6, 6, 5)
    expect(date).toBeDefined()
  })
})

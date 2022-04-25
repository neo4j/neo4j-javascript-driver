import neo4j, {
  Driver,
  Session,
  Transaction,
  Result,
  RxSession,
  RxTransaction,
  RxResult,
  ResultSummary,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Notification,
  ServerInfo,
  Record,
  Node,
  Relationship,
  UnboundRelationship,
  Path,
  PathSegment,
  Point,
  Integer,
  Neo4jError,
  Duration,
  LocalTime,
  Time,
  Date,
  LocalDateTime,
  DateTime
} from '../src'

import {
  ResultSummary as InternalResultSummary,
  Plan as InternalPlan,
  ProfiledPlan as InternalProfiledPlan,
  QueryStatistics as InternalQueryStatistics,
  Notification as InternalNotification,
  ServerInfo as InternalServerInfo,
  Record as InternalRecord,
  Node as InternalNode,
  Relationship as InternalRelationship,
  UnboundRelationship as InternalUnboundRelationship,
  Path as InternalPath,
  PathSegment as InternalPathSegment,
  Point as InternalPoint,
  Integer as InternalInteger,
  Neo4jError as InternalNeo4jError,
  Duration as InternalDuration,
  LocalTime as InternalLocalTime,
  Time as InternalTime,
  Date as InternalDate,
  LocalDateTime as InternalLocalDateTime,
  DateTime as InternalDateTime
} from 'neo4j-driver-core'

describe('#unit index', () => {
  describe('instanceof', () => {
    describe('neo4j.driver() return', () => {
      it('should be an instanceof neo4j.Driver', () => {
        const driver = neo4j.driver('bolt://localhost')
        expect(driver).toBeInstanceOf(neo4j.Driver)
      })

      it('should be an instanceof Driver', () => {
        const driver = neo4j.driver('bolt://localhost')
        expect(driver).toBeInstanceOf(Driver)
      })
    })

    describe('driver.session() return', () => {
      it('should be instanceof neo4j.Session', () => {
        const session = subject()
        expect(session).toBeInstanceOf(neo4j.Session)
      })

      it('should be instanceof Session', () => {
        const session = subject()
        expect(session).toBeInstanceOf(Session)
      })

      function subject () {
        const driver = neo4j.driver('bolt://localhost')
        return driver.session()
      }
    })

    describe('session.beginTransaction() return', () => {
      it('should be instanceof neo4j.Transaction', () => {
        const transaction = subject()
        expect(transaction).toBeInstanceOf(neo4j.Transaction)
      })

      it('should be instanceof Transaction', () => {
        const transaction = subject()
        expect(transaction).toBeInstanceOf(Transaction)
      })

      function subject () {
        const driver = neo4j.driver('bolt://localhost')
        return driver.session().beginTransaction()
      }
    })

    describe('session.run() return', () => {
      it('should be instanceof neo4j.Result', () => {
        const result = subject()
        expect(result).toBeInstanceOf(neo4j.Result)
      })

      it('should be instanceof Result', () => {
        const result = subject()
        expect(result).toBeInstanceOf(Result)
      })

      function subject () {
        const driver = neo4j.driver('bolt://localhost')
        return driver.session().run('RETURN 1')
      }
    })

    describe('driver.rxSession() return', () => {
      it('should be instanceof neo4j.RxSession', () => {
        const session = subject()
        expect(session).toBeInstanceOf(neo4j.RxSession)
      })

      it('should be instanceof RxSession', () => {
        const session = subject()
        expect(session).toBeInstanceOf(RxSession)
      })

      function subject () {
        const driver = neo4j.driver('bolt://localhost')
        return driver.rxSession()
      }
    })

    describe('await rxRession.beginTransaction().toPromise() return', () => {
      it('should be instanceof neo4j.RxTransaction', async () => {
        const transaction = await subject()
        expect(transaction).toBeInstanceOf(neo4j.RxTransaction)
      })

      it('should be instanceof RxTransaction', async () => {
        const transaction = await subject()
        expect(transaction).toBeInstanceOf(RxTransaction)
      })

      function subject () {
        const driver = neo4j.driver('bolt://localhost')
        return driver.rxSession().beginTransaction().toPromise()
      }
    })

    describe('rxSession.run() return', () => {
      it('should be instanceof neo4j.RxResult', async () => {
        const result = subject()
        expect(result).toBeInstanceOf(neo4j.RxResult)
      })

      it('should be instanceof RxResult', async () => {
        const result = subject()
        expect(result).toBeInstanceOf(RxResult)
      })

      function subject () {
        const driver = neo4j.driver('bolt://localhost')
        return driver.rxSession().run()
      }
    })

    describe('ResultSummary', () => {
      it('should be instanceof neo4j.ResultSummary', () => {
        expect(subject()).toBeInstanceOf(neo4j.ResultSummary)
      })

      it('should be instanceof ResultSummary', () => {
        expect(subject()).toBeInstanceOf(ResultSummary)
      })

      function subject () {
        return new InternalResultSummary('query', {}, {}, 5.0)
      }
    })

    describe('Plan', () => {
      it('should be instanceof neo4j.Plan', () => {
        expect(subject()).toBeInstanceOf(neo4j.Plan)
      })

      it('should be instanceof Plan', () => {
        expect(subject()).toBeInstanceOf(Plan)
      })

      function subject () {
        return new InternalPlan({})
      }
    })

    describe('ProfiledPlan', () => {
      it('should be instanceof neo4j.ProfiledPlan', () => {
        expect(subject()).toBeInstanceOf(neo4j.ProfiledPlan)
      })

      it('should be instanceof ProfiledPlan', () => {
        expect(subject()).toBeInstanceOf(ProfiledPlan)
      })

      function subject () {
        return new InternalProfiledPlan({})
      }
    })

    describe('QueryStatistics', () => {
      it('should be instanceof neo4j.QueryStatistics', () => {
        expect(subject()).toBeInstanceOf(neo4j.QueryStatistics)
      })

      it('should be instanceof QueryStatistics', () => {
        expect(subject()).toBeInstanceOf(QueryStatistics)
      })

      function subject () {
        return new InternalQueryStatistics({})
      }
    })

    describe('Notification', () => {
      it('should be instanceof neo4j.Notification', () => {
        expect(subject()).toBeInstanceOf(neo4j.Notification)
      })

      it('should be instanceof Notification', () => {
        expect(subject()).toBeInstanceOf(Notification)
      })

      function subject () {
        return new InternalNotification({})
      }
    })

    describe('ServerInfo', () => {
      it('should be instanceof neo4j.ServerInfo', () => {
        expect(subject()).toBeInstanceOf(neo4j.ServerInfo)
      })

      it('should be instanceof ServerInfo', () => {
        expect(subject()).toBeInstanceOf(ServerInfo)
      })

      function subject () {
        return new InternalServerInfo({}, 5.0)
      }
    })

    describe('Record', () => {
      it('should be instanceof neo4j.Record', () => {
        expect(subject()).toBeInstanceOf(neo4j.Record)
      })

      it('should be instanceof Record', () => {
        expect(subject()).toBeInstanceOf(Record)
      })

      function subject () {
        return new InternalRecord([], [])
      }
    })

    describe('Node', () => {
      it('should be instanceof neo4j.Node', () => {
        expect(subject()).toBeInstanceOf(neo4j.Node)
      })

      it('should be instanceof Node', () => {
        expect(subject()).toBeInstanceOf(Node)
      })

      function subject () {
        return new InternalNode(1, [], [])
      }
    })

    describe('Relationship', () => {
      it('should be instanceof neo4j.Relationship', () => {
        expect(subject()).toBeInstanceOf(neo4j.Relationship)
      })

      it('should be instanceof Relationship', () => {
        expect(subject()).toBeInstanceOf(Relationship)
      })

      function subject () {
        return new InternalRelationship(1, 1, 1, 'Type', [], [])
      }
    })

    describe('UnboundRelationship', () => {
      it('should be instanceof neo4j.UnboundRelationship', () => {
        expect(subject()).toBeInstanceOf(neo4j.UnboundRelationship)
      })

      it('should be instanceof UnboundRelationship', () => {
        expect(subject()).toBeInstanceOf(UnboundRelationship)
      })

      function subject () {
        return new InternalUnboundRelationship(1, 'Type', [])
      }
    })

    describe('Path', () => {
      it('should be instanceof neo4j.Path', () => {
        expect(subject()).toBeInstanceOf(neo4j.Path)
      })

      it('should be instanceof Path', () => {
        expect(subject()).toBeInstanceOf(Path)
      })

      function subject () {
        return new InternalPath(new InternalNode(1, [], []), new InternalNode(1, [], []), [])
      }
    })

    describe('PathSegment', () => {
      it('should be instanceof neo4j.PathSegment', () => {
        expect(subject()).toBeInstanceOf(neo4j.PathSegment)
      })

      it('should be instanceof PathSegment', () => {
        expect(subject()).toBeInstanceOf(PathSegment)
      })

      function subject () {
        return new InternalPathSegment(new InternalNode(1, [], []), new InternalNode(1, [], []), [])
      }
    })

    describe('Point', () => {
      it('should be instanceof neo4j.Point', () => {
        expect(subject()).toBeInstanceOf(neo4j.Point)
      })

      it('should be instanceof Point', () => {
        expect(subject()).toBeInstanceOf(Point)
      })

      function subject () {
        return new InternalPoint(1, 1, 1)
      }
    })

    describe('Integer', () => {
      it('should be instanceof neo4j.Integer', () => {
        expect(subject()).toBeInstanceOf(neo4j.Integer)
      })

      it('should be instanceof Integer', () => {
        expect(subject()).toBeInstanceOf(Integer)
      })

      function subject () {
        return new InternalInteger(1, 1)
      }
    })

    describe('Neo4jError', () => {
      it('should be instanceof neo4j.Neo4jError', () => {
        expect(subject()).toBeInstanceOf(neo4j.Neo4jError)
      })

      it('should be instanceof Neo4jError', () => {
        expect(subject()).toBeInstanceOf(Neo4jError)
      })

      function subject () {
        return new InternalNeo4jError('Message', 'N/A')
      }
    })

    describe('Duration', () => {
      it('should be instanceof neo4j.Duration', () => {
        expect(subject()).toBeInstanceOf(neo4j.Duration)
      })

      it('should be instanceof Duration', () => {
        expect(subject()).toBeInstanceOf(Duration)
      })

      function subject () {
        return new InternalDuration(1, 1, 1, 1)
      }
    })

    describe('LocalTime', () => {
      it('should be instanceof neo4j.LocalTime', () => {
        expect(subject()).toBeInstanceOf(neo4j.LocalTime)
      })

      it('should be instanceof LocalTime', () => {
        expect(subject()).toBeInstanceOf(LocalTime)
      })

      function subject () {
        return new InternalLocalTime(1, 1, 1, 1)
      }
    })

    describe('Time', () => {
      it('should be instanceof neo4j.Time', () => {
        expect(subject()).toBeInstanceOf(neo4j.Time)
      })

      it('should be instanceof Time', () => {
        expect(subject()).toBeInstanceOf(Time)
      })

      function subject () {
        return new InternalTime(1, 1, 1, 1, 1)
      }
    })

    describe('Date', () => {
      it('should be instanceof neo4j.Date', () => {
        expect(subject()).toBeInstanceOf(neo4j.Date)
      })

      it('should be instanceof Date', () => {
        expect(subject()).toBeInstanceOf(Date)
      })

      function subject () {
        return new InternalDate(1, 1, 1)
      }
    })

    describe('LocalDateTime', () => {
      it('should be instanceof neo4j.LocalDateTime', () => {
        expect(subject()).toBeInstanceOf(neo4j.LocalDateTime)
      })

      it('should be instanceof LocalDateTime', () => {
        expect(subject()).toBeInstanceOf(LocalDateTime)
      })

      function subject () {
        return new InternalLocalDateTime(1, 1, 1, 1, 1, 1, 1)
      }
    })

    describe('DateTime', () => {
      it('should be instanceof neo4j.DateTime', () => {
        expect(subject()).toBeInstanceOf(neo4j.DateTime)
      })

      it('should be instanceof DateTime', () => {
        expect(subject()).toBeInstanceOf(DateTime)
      })

      function subject () {
        return new InternalDateTime(1, 1, 1, 1, 1, 1, 1, 1)
      }
    })
  })
})

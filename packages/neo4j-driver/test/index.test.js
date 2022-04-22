import neo4j, { 
  Driver, 
  Session, 
  Transaction,
  ManagedTransaction, 
  Result, 
  RxSession, 
  RxTransaction,
  RxManagedTransaction,
  RxResult,
  ResultSummary,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Notification,
  ServerInfo,
  Record
} from '../src'

import { 
  ManagedTransaction as InternalManagedTransaction, 
  ResultSummary as InternalResultSummary,
  Plan as InternalPlan,
  ProfiledPlan as InternalProfiledPlan,
  QueryStatistics as InternalQueryStatistics,
  Notification as InternalNotification,
  ServerInfo as InternalServerInfo,
  Record as InternalRecord
} from 'neo4j-driver-core'
import InternalRxManagedTransaction from '../src/transaction-managed-rx'

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

      function subject() {
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

      function subject() {
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

      function subject() {
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

      function subject() {
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

      function subject() {
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

      function subject() {
        const driver = neo4j.driver('bolt://localhost')
        return driver.rxSession().run()
      }
    })

    describe('ManagedTransaction', () => {
      it('should be instanceof neo4j.ManagedTransaction', () => {
        expect(subject()).toBeInstanceOf(neo4j.ManagedTransaction)
      })

      it('should be instanceof ManagedTransaction', () => {
        expect(subject()).toBeInstanceOf(ManagedTransaction)
      })

      function subject() {
        const driver = neo4j.driver('bolt://localhost')
        const tx =  driver.session().beginTransaction()
        return InternalManagedTransaction.fromTransaction(tx)
      }
    })

    describe('RxManagedTransaction', () => {
      it('should be instanceof neo4j.RxManagedTransaction', async () => {
        const rxManagedTransaction = await subject()
        expect(rxManagedTransaction).toBeInstanceOf(neo4j.RxManagedTransaction)
      })

      it('should be instanceof RxManagedTransaction', async () => {
        const rxManagedTransaction = await subject()
        expect(rxManagedTransaction).toBeInstanceOf(RxManagedTransaction)
      })

      async function subject() {
        const driver = neo4j.driver('bolt://localhost')
        const tx =  await driver.rxSession().beginTransaction().toPromise()
        return InternalRxManagedTransaction.fromTransaction(tx)
      }
    })

    describe('ResultSummary', () => {
      it('should be instanceof neo4j.ResultSummary', () => {
        expect(subject()).toBeInstanceOf(neo4j.ResultSummary)
      })

      it('should be instanceof ResultSummary', () => {
        expect(subject()).toBeInstanceOf(ResultSummary)
      })

      function subject() {
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

      function subject() {
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

      function subject() {
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

      function subject() {
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

      function subject() {
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

      function subject() {
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

      function subject() {
        return new InternalRecord([], [])
      }
    })
  })
})

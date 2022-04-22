import neo4j, { Driver, Session, Transaction, Result, RxSession, RxTransaction, RxResult } from '../src'

describe('#unit index', () =>  {
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
  })
})

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

import { Notification, throwError } from 'rxjs'
import {
  flatMap,
  materialize,
  toArray,
  concat,
  map,
  bufferCount,
  catchError
} from 'rxjs/operators'
import neo4j from '../../src'
import { ServerVersion, VERSION_4_0_0 } from '../../src/internal/server-version'
import RxSession from '../../src/session-rx'
import RxTransaction from '../../src/transaction-rx'
import sharedNeo4j from '../internal/shared-neo4j'
import { newError } from '../../src/error'

describe('#integration-rx transaction', () => {
  let driver
  /** @type {RxSession} */
  let session
  /** @type {ServerVersion} */
  let serverVersion

  beforeEach(async () => {
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
    session = driver.rxSession()

    const normalSession = driver.session()
    try {
      const result = await normalSession.run('MATCH (n) DETACH DELETE n')
      serverVersion = ServerVersion.fromString(result.summary.server.version)
    } finally {
      await normalSession.close()
    }
  })

  afterEach(async () => {
    if (session) {
      await session.close().toPromise()
    }
    driver.close()
  })

  it('should commit an empty transaction', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const result = await session
      .beginTransaction()
      .pipe(
        flatMap(txc => txc.commit()),
        materialize(),
        toArray()
      )
      .toPromise()

    expect(result).toEqual([Notification.createComplete()])
  })

  it('should rollback an empty transaction', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const result = await session
      .beginTransaction()
      .pipe(
        flatMap(txc => txc.rollback()),
        materialize(),
        toArray()
      )
      .toPromise()

    expect(result).toEqual([Notification.createComplete()])
  })

  it('should run statement and commit', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const result = await session
      .beginTransaction()
      .pipe(
        flatMap(txc =>
          txc
            .run('CREATE (n:Node {id: 42}) RETURN n')
            .records()
            .pipe(
              map(r => r.get('n').properties['id']),
              concat(txc.commit())
            )
        ),
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result).toEqual([
      Notification.createNext(neo4j.int(42)),
      Notification.createComplete()
    ])

    expect(await countNodes(42)).toBe(1)
  })

  it('should run statement and rollback', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const result = await session
      .beginTransaction()
      .pipe(
        flatMap(txc =>
          txc
            .run('CREATE (n:Node {id: 42}) RETURN n')
            .records()
            .pipe(
              map(r => r.get('n').properties['id']),
              concat(txc.rollback())
            )
        ),
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result).toEqual([
      Notification.createNext(neo4j.int(42)),
      Notification.createComplete()
    ])

    expect(await countNodes(42)).toBe(0)
  })

  it('should run multiple statements and commit', async () => {
    await verifyCanRunMultipleStatements(true)
  })

  it('should run multiple statements and rollback', async () => {
    await verifyCanRunMultipleStatements(false)
  })

  it('should run multiple statements without waiting and commit', async () => {
    await verifyCanRunMultipleStatementsWithoutWaiting(true)
  })

  it('should run multiple statements without waiting and rollback', async () => {
    await verifyCanRunMultipleStatementsWithoutWaiting(false)
  })

  it('should run multiple statements without streaming and commit', async () => {
    await verifyCanRunMultipleStatementsWithoutStreaming(true)
  })

  it('should run multiple statements without streaming and rollback', async () => {
    await verifyCanRunMultipleStatementsWithoutStreaming(false)
  })

  it('should fail to commit after a failed statement', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()

    await verifyFailsWithWrongStatement(txc)

    const error = await txc
      .commit()
      .pipe(
        materialize(),
        map(n => n.error)
      )
      .toPromise()
    expect(error).toBeTruthy()
    expect(error.error).toContain(
      'Cannot commit statements in this transaction'
    )
  })

  it('should succeed to rollback after a failed statement', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()

    await verifyFailsWithWrongStatement(txc)

    const result = await txc
      .rollback()
      .pipe(
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result).toEqual([Notification.createComplete()])
  })

  it('should fail to commit after successful and failed statement', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()

    await verifyCanCreateNode(txc, 5)
    await verifyCanReturnOne(txc)
    await verifyFailsWithWrongStatement(txc)

    const error = await txc
      .commit()
      .pipe(
        materialize(),
        map(n => n.error)
      )
      .toPromise()
    expect(error).toBeTruthy()
    expect(error.error).toContain(
      'Cannot commit statements in this transaction'
    )
  })

  it('should succeed to rollback after successful and failed statement', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()

    await verifyCanCreateNode(txc, 5)
    await verifyCanReturnOne(txc)
    await verifyFailsWithWrongStatement(txc)

    const result = await txc
      .rollback()
      .pipe(
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result).toEqual([Notification.createComplete()])
  })

  it('should fail to run another statement after a failed one', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()

    await verifyFailsWithWrongStatement(txc)

    const error = await txc
      .run('CREATE ()')
      .records()
      .pipe(
        materialize(),
        map(n => n.error)
      )
      .toPromise()
    expect(error).toBeTruthy()
    expect(error.error).toContain(
      'Cannot run statement, because previous statements in the transaction has failed'
    )
  })

  it('should allow commit after commit', async () => {
    // TODO: behaviour difference across drivers
    return

    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
    }

    const txc = await session.beginTransaction().toPromise()

    await verifyCanCreateNode(txc, 6)
    await verifyCanCommit(txc)

    const result = await txc
      .commit()
      .pipe(
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result).toEqual([Notification.createComplete()])
  })

  it('should allow rollback after rollback', async () => {
    // TODO: behaviour difference across drivers
    return

    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
    }

    const txc = await session.beginTransaction().toPromise()

    await verifyCanCreateNode(txc, 6)
    await verifyCanRollback(txc)

    const result = await txc
      .rollback()
      .pipe(
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result).toEqual([Notification.createComplete()])
  })

  it('should fail to rollback after commit', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()

    await verifyCanCreateNode(txc, 6)
    await verifyCanCommit(txc)

    const error = await txc
      .rollback()
      .pipe(
        materialize(),
        map(n => n.error)
      )
      .toPromise()
    expect(error.error).toContain(
      'Cannot rollback transaction, because transaction has already been successfully closed'
    )
  })

  it('should fail to commit after rollback', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()

    await verifyCanCreateNode(txc, 6)
    await verifyCanRollback(txc)

    const error = await txc
      .commit()
      .pipe(
        materialize(),
        map(n => n.error)
      )
      .toPromise()
    expect(error.error).toContain(
      'Cannot commit this transaction, because it has already been rolled back'
    )
  })

  it('should fail to run statement after committed transaction', async () => {
    await verifyFailToRunStatementAfterTxcIsComplete(true)
  })

  it('should fail to run statement after rollbacked transaction', async () => {
    await verifyFailToRunStatementAfterTxcIsComplete(false)
  })

  it('should update bookmark', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const bookmark0 = session.lastBookmark()

    const txc1 = await session.beginTransaction().toPromise()
    await verifyCanCreateNode(txc1, 20)
    await verifyCanCommit(txc1)
    const bookmark1 = session.lastBookmark()

    const txc2 = await session.beginTransaction().toPromise()
    await verifyCanCreateNode(txc2, 21)
    await verifyCanCommit(txc2)
    const bookmark2 = session.lastBookmark()

    expect(bookmark0).toBeFalsy()
    expect(bookmark1).toBeTruthy()
    expect(bookmark1).not.toEqual(bookmark0)
    expect(bookmark2).toBeTruthy()
    expect(bookmark2).not.toEqual(bookmark1)
  })

  it('should propagate failures from statements', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()

    const result1 = txc.run('CREATE (:TestNode) RETURN 1 AS n')
    const result2 = txc.run('CREATE (:TestNode) RETURN 2 AS n')
    const result3 = txc.run('RETURN 10 / 0 AS n')
    const result4 = txc.run('CREATE (:TestNode) RETURN 3 AS n')

    const result = await result1
      .records()
      .pipe(
        concat(result2.records()),
        concat(result3.records()),
        concat(result4.records()),
        map(r => r.get(0).toInt()),
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result).toEqual([
      Notification.createNext(1),
      Notification.createNext(2),
      Notification.createError(newError('/ by zero'))
    ])

    await verifyCanRollback(txc)
  })

  it('should not run until subscribed', async () => {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()

    const result1 = txc.run('RETURN 1')
    const result2 = txc.run('RETURN 2')
    const result3 = txc.run('RETURN 3')
    const result4 = txc.run('RETURN 4')

    const result = await result4
      .records()
      .pipe(
        concat(result3.records()),
        concat(result2.records()),
        concat(result1.records()),
        map(r => r.get(0).toInt()),
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result).toEqual([
      Notification.createNext(4),
      Notification.createNext(3),
      Notification.createNext(2),
      Notification.createNext(1),
      Notification.createComplete()
    ])

    await verifyCanCommit(txc)
  })

  it('should not propagate failure on commit if not executed', async () => {
    await verifyNoFailureIfNotExecuted(true)
  })

  it('should not propagate failure on rollback if not executed', async () => {
    await verifyNoFailureIfNotExecuted(false)
  })

  it('should not propagate run failure from summary', async () => {
    // TODO: behaviour difference across drivers
    return
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
    }

    const txc = await session.beginTransaction().toPromise()
    const result = txc.run('RETURN Wrong')

    const error = await result
      .records()
      .pipe(
        materialize(),
        map(n => n.error)
      )
      .toPromise()
    expect(error.message).toContain('Variable `Wrong` not defined')

    const summary = await result.summary().toPromise()
    expect(summary).toBeTruthy()
  })

  it('should handle nested queries', async () => {
    const size = 1024
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const messages = await session
      .beginTransaction()
      .pipe(
        flatMap(txc =>
          txc
            .run('UNWIND RANGE(1, $size) AS x RETURN x', { size })
            .records()
            .pipe(
              map(r => r.get(0)),
              bufferCount(50),
              flatMap(x =>
                txc
                  .run('UNWIND $x AS id CREATE (n:Node {id: id}) RETURN n.id', {
                    x
                  })
                  .records()
              ),
              map(r => r.get(0)),
              concat(txc.commit()),
              catchError(err => txc.rollback().pipe(concat(throwError(err)))),
              materialize(),
              toArray()
            )
        )
      )
      .toPromise()

    expect(messages.length).toBe(size + 1)
    expect(messages[size]).toEqual(Notification.createComplete())
  })

  async function verifyNoFailureIfNotExecuted (commit) {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()

    txc.run('RETURN ILLEGAL')

    await verifyCanCommitOrRollback(txc, commit)
  }

  async function verifyFailToRunStatementAfterTxcIsComplete (commit) {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()
    await verifyCanCreateNode(txc, 15)
    await verifyCanCommitOrRollback(txc, commit)

    const error = await txc
      .run('CREATE ()')
      .records()
      .pipe(
        materialize(),
        map(n => n.error)
      )
      .toPromise()
    expect(error.error).toContain('Cannot run statement, because transaction')
  }

  async function verifyCanRunMultipleStatements (commit) {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()

    await txc
      .run('CREATE (n:Node {id: 1})')
      .summary()
      .toPromise()
    await txc
      .run('CREATE (n:Node {id: 2})')
      .summary()
      .toPromise()
    await txc
      .run('CREATE (n:Node {id: 1})')
      .summary()
      .toPromise()

    await verifyCanCommitOrRollback(txc, commit)
    await verifyCommittedOrRollbacked(commit)
  }

  async function verifyCanRunMultipleStatementsWithoutWaiting (commit) {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()

    const result1 = txc.run('CREATE (n:Node {id: 1})')
    const result2 = txc.run('CREATE (n:Node {id: 2})')
    const result3 = txc.run('CREATE (n:Node {id: 1})')

    const results = await result1
      .records()
      .pipe(
        concat(result2.records()),
        concat(result3.records()),
        materialize(),
        toArray()
      )
      .toPromise()
    expect(results).toEqual([Notification.createComplete()])

    await verifyCanCommitOrRollback(txc, commit)
    await verifyCommittedOrRollbacked(commit)
  }

  async function verifyCanRunMultipleStatementsWithoutStreaming (commit) {
    if (serverVersion.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const txc = await session.beginTransaction().toPromise()

    const result1 = txc.run('CREATE (n:Node {id: 1})')
    const result2 = txc.run('CREATE (n:Node {id: 2})')
    const result3 = txc.run('CREATE (n:Node {id: 1})')

    const results = await result1
      .keys()
      .pipe(
        concat(result2.keys()),
        concat(result3.keys()),
        materialize(),
        toArray()
      )
      .toPromise()
    expect(results).toEqual([
      Notification.createNext([]),
      Notification.createNext([]),
      Notification.createNext([]),
      Notification.createComplete()
    ])

    await verifyCanCommitOrRollback(txc, commit)
    await verifyCommittedOrRollbacked(commit)
  }

  async function verifyCanCommit (txc) {
    const result = await txc
      .commit()
      .pipe(
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result).toEqual([Notification.createComplete()])
  }

  async function verifyCanRollback (txc) {
    const result = await txc
      .rollback()
      .pipe(
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result).toEqual([Notification.createComplete()])
  }

  async function verifyCanCommitOrRollback (txc, commit) {
    if (commit) {
      await verifyCanCommit(txc)
    } else {
      await verifyCanRollback(txc)
    }
  }

  async function verifyCanCreateNode (txc, id) {
    const result = await txc
      .run('CREATE (n:Node {id: $id}) RETURN n', { id: neo4j.int(id) })
      .records()
      .pipe(
        map(r => r.get('n').properties['id']),
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result).toEqual([
      Notification.createNext(neo4j.int(id)),
      Notification.createComplete()
    ])
  }

  async function verifyCanReturnOne (txc) {
    const result = await txc
      .run('RETURN 1')
      .records()
      .pipe(
        map(r => r.get(0)),
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result).toEqual([
      Notification.createNext(neo4j.int(1)),
      Notification.createComplete()
    ])
  }

  async function verifyFailsWithWrongStatement (txc) {
    const error = await txc
      .run('RETURN')
      .records()
      .pipe(
        materialize(),
        map(n => n.error)
      )
      .toPromise()

    expect(error).toBeTruthy()
    expect(error.code).toContain('SyntaxError')
  }

  async function verifyCommittedOrRollbacked (commit) {
    if (commit) {
      expect(await countNodes(1)).toBe(2)
      expect(await countNodes(2)).toBe(1)
    } else {
      expect(await countNodes(1)).toBe(0)
      expect(await countNodes(2)).toBe(0)
    }
  }

  async function countNodes (id) {
    const session = driver.rxSession()
    return await session
      .run('MATCH (n:Node {id: $id}) RETURN count(n)', { id: id })
      .records()
      .pipe(
        map(r => r.get(0).toInt()),
        concat(session.close())
      )
      .toPromise()
  }
})

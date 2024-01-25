import { BadRequestError } from './error'

async function executeSequential (queries, exec) {
  for (const query of queries) {
    await exec(query)
  }
}

async function executeParallel (queries, exec) {
  return await Promise.all(queries.map(exec))
}

function executeQuery (executor) {
  return async (driver, workload) => await executor(workload.queries, (query) => {
    return driver.executeQuery(query.text, query.parameters, {
      database: workload.database,
      routing: workload.routing
    })
  })
}

function sessionRunPerSession (executor) {
  return async (driver, workload) => {
    return await executor(workload.queries, async (query) => {
      const session = driver.session({ database: workload.database, defaultAccessMode: workload.routing })

      try {
        return await session.run(query.text, query.parameters)
      } finally {
        await session.close()
      }
    })
  }
}

async function sessionRunSequentialTransactions (driver, workload) {
  const session = driver.session({ database: workload.database, defaultAccessMode: workload.routing })

  try {
    return await executeSequential(workload.queries, async (query) => session.run(query.text, query.parameters))
  } finally {
    await session.close()
  }
}

function executeReadPerSession (executor) {
  return async (driver, workload) => {
    return await executor(workload.queries, async (query) => {
      const session = driver.session({ database: workload.database, defaultAccessMode: workload.routing })
      try {
        await session.executeRead(async tx => {
          return tx.run(query.text, query.parameters)
        })
      } finally {
        await session.close()
      }
    })
  }
}

async function executeReadSequentialTransactions (driver, workload) {
  const session = driver.session({ database: workload.database, defaultAccessMode: workload.routing })
  try {
    await executeSequential(workload.queries, async (query) => {
      await session.executeRead(async tx => {
        return tx.run(query.text, query.parameters)
      })
    })
  } finally {
    await session.close()
  }
}

async function executeReadSequentialQueries (driver, workload) {
  const session = driver.session({ database: workload.database, defaultAccessMode: workload.routing })
  try {
    await session.executeRead(async tx => {
      await executeSequential(workload.queries, async (query) => {
        return tx.run(query.text, query.parameters)
      })
    })
  } finally {
    await session.close()
  }
}

function executeWritePerSession (executor) {
  return async (driver, workload) => {
    return await executor(workload.queries, async (query) => {
      const session = driver.session({ database: workload.database, defaultAccessMode: workload.routing })
      try {
        await session.executeWrite(async tx => {
          return tx.run(query.text, query.parameters)
        })
      } finally {
        await session.close()
      }
    })
  }
}

async function executeWriteSequentialTransactions (driver, workload) {
  const session = driver.session({ database: workload.database, defaultAccessMode: workload.routing })
  try {
    await executeSequential(workload.queries, async (query) => {
      await session.executeWrite(async tx => {
        return tx.run(query.text, query.parameters)
      })
    })
  } finally {
    await session.close()
  }
}

async function executeWriteSequentialQueries (driver, workload) {
  const session = driver.session({ database: workload.database, defaultAccessMode: workload.routing })
  try {
    await session.executeWrite(async tx => {
      await executeSequential(workload.queries, async (query) => {
        return tx.run(query.text, query.parameters)
      })
    })
  } finally {
    await session.close()
  }
}

async function throwBadRequest () {
  throw new BadRequestError('Workload executor method not available')
}

function throwExecutorMethodNotAvailable () {
  return {
    sequentialSessions: throwBadRequest,
    sequentialTransactions: throwBadRequest,
    sequentialQueries: throwBadRequest,
    parallelSessions: throwBadRequest
  }
}

const workloadExecutorsByMethodByMode = {
  executeQuery: {
    sequentialSessions: executeQuery(executeSequential),
    parallelSessions: executeQuery(executeParallel)
  },
  executeRead: {
    sequentialSessions: executeReadPerSession(executeSequential),
    sequentialTransactions: executeReadSequentialTransactions,
    sequentialQueries: executeReadSequentialQueries,
    parallelSessions: executeReadPerSession(executeParallel)
  },
  executeWrite: {
    sequentialSessions: executeWritePerSession(executeSequential),
    sequentialTransactions: executeWriteSequentialTransactions,
    sequentialQueries: executeWriteSequentialQueries,
    parallelSessions: executeWritePerSession(executeParallel)
  },
  sessionRun: {
    sequentialSessions: sessionRunPerSession(executeSequential),
    sequentialTransactions: sessionRunSequentialTransactions,
    parallelSessions: sessionRunPerSession(executeParallel)
  }
}

export default function WorkloadExecutor (driver) {
  return {
    execute (workload) {
      const workloadExecutorsByMode = workloadExecutorsByMethodByMode[workload.method] || throwExecutorMethodNotAvailable
      const executor = workloadExecutorsByMode[workload.mode]
      return executor(driver, workload)
    }
  }
}

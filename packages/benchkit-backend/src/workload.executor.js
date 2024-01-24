import { BadRequestError } from './error'

function isSequentialWorkload (workload) {
  return workload.mode == null || workload.mode === 'sequence'
}

async function execute (workload, exec) {
  if (isSequentialWorkload(workload)) {
    for (const query of workload.queries) {
      await exec(query)
    }
  } else {
    return await Promise.all(workload.queries.map(exec))
  }
}

async function executeQuery (driver, workload) {
  await execute(workload, (query) => {
    return driver.executeQuery(query.text, query.parameters, {
      database: workload.database,
      routing: workload.routing
    })
  })
}

async function sessionRun (driver, workload) {
  const session = driver.session({ database: workload.database, defaultAccessMode: workload.routing })

  try {
    await execute(workload, (query) => {
      return session.run(query.text, query.parameters)
    })
  } finally {
    await session.close()
  }
}

async function executeRead (driver, workload) {
  const session = driver.session({ database: workload.database, defaultAccessMode: workload.routing })

  try {
    await session.executeRead(async tx => {
      await execute(workload, (query) => {
        return tx.run(query.text, query.parameters)
      })
    })
  } finally {
    await session.close()
  }
}

async function executeWrite (driver, workload) {
  const session = driver.session({ database: workload.database, defaultAccessMode: workload.routing })

  try {
    await session.executeWrite(async tx => {
      await execute(workload, (query) => {
        return tx.run(query.text, query.parameters)
      })
    })
  } finally {
    await session.close()
  }
}

async function throwExecutorMethodNotAvailable () {
  throw new BadRequestError('Workload executor method not available')
}

const workloadExecutorsByMethod = {
  executeQuery,
  executeRead,
  executeWrite,
  sessionRun
}

export default function WorkloadExecutor (driver) {
  return {
    execute (workload) {
      const executor = workloadExecutorsByMethod[workload.method] || throwExecutorMethodNotAvailable
      return executor(driver, workload)
    }
  }
}

import express from 'express'
import config from './config'
import neo4j from 'neo4j-driver'
import WorkloadExecutor from './workload.executor'
import WorkloadRouter from './workload.router'
import ReadyRouter from './ready.router'

const neo4jUrl = `${config.scheme}://${config.hostname}:${config.boltPort}`
const driver = neo4j.driver(neo4jUrl, neo4j.auth.basic(config.username, config.password), {
  logging: config.logLevel != null ? neo4j.logging.console(config.logLevel) : undefined
})
const executor = WorkloadExecutor(driver)

const server = express()
  .disable('x-powered-by')
  .use(express.json({
    type: 'application/json'
  }))
  .use(config.workloadRoute, WorkloadRouter(executor.execute, config.workloadRoute))
  .use(config.readyRoute, ReadyRouter(() => driver.verifyConnectivity()))
  .use((err, _req, res, _) => {
    console.log(err)
    res.status(err.status || 500).end()
  })
  .listen(config.backendPort, () => {
    console.log(`index.js:${process.pid}:Listening on ${config.backendPort}`)
  })

process.on('SIGTERM', () => {
  console.debug('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    driver.close()
      .catch((error) => console.err('Error closing the driver', error))
  })
})

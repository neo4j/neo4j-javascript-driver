export default {
  backendPort: process.env.TEST_BACKEND_PORT || 9000,
  requestTimeout: Number(process.env.TEST_REQ_TIMEOUT) || 5000,
  username: process.env.TEST_NEO4J_USER || 'neo4j',
  password: process.env.TEST_NEO4J_PASS || 'password',
  hostname: process.env.TEST_NEO4J_HOST || 'localhost',
  scheme: process.env.TEST_NEO4J_SCHEME || 'neo4j',
  boltPort: process.env.TEST_NEO4J_BOLT_PORT || 7687,
  logLevel: process.env.TEST_NEO4J_LOG_LEVEL,
  workloadRoute: '/workload',
  readyRoute: '/ready'
}

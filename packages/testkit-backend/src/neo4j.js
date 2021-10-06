import neo4jDriver from 'neo4j-driver'
import neo4jDriverLite from 'neo4j-driver-lite'

const isLite = ['TRUE', '1'].includes((process.env.TEST_DRIVER_LITE || 'False').toUpperCase())
const neo4j = isLite ? neo4jDriverLite : neo4jDriver

export default neo4j

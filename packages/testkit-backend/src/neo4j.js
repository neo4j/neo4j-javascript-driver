import neo4jDriver from 'neo4j-driver'
import neo4jDriverLite from 'neo4j-driver-lite'

const isLite = (process.env.TEST_DRIVER_LITE || 'False').toUpperCase() in ['TRUE', '1']
const neo4j = isLite ? neo4jDriverLite : neo4jDriver

export default neo4j

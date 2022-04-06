import neo4j from 'neo4j-driver-lite'

const driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j','pass'));

const matchAllNodes = await driver.plan('MATCH (n) RETURN n')

for await(const record of await driver.execute(matchAllNodes)) {
  console.log(record.get('n').properties);
}

const createPerson = await driver.plan('CREATE (n:Person {name: $name, born: $born}) RETURN n')
const createFakeAntonio = createPerson.withParameters({ name: 'Antonio', born: 1999n})
const createPersonResult = await driver.execute(createFakeAntonio)
console.log('Person created', createPersonResult.sumamry)

// Should print the property of all nodes in the driver as in the first matchAllNodes query
for await(const record of await driver.execute(matchAllNodes.withRecordMapper(record => record.get('n').properties))) {
  console.log(record);
}


const getMovies = await driver.plan('MATCH (m:Movie) RETURN m')
const getPeople = await driver.plan('MATCH (p:Person) RETURN p')

const nodeAsObject = nodeName => record => record.get(nodeName).properties


const [movies, people] = await driver.execute([
  getMovies.withRecordMapper(nodeAsObject('m')), 
  getPeople.withRecordMapper(nodeAsObject('p'))
])

console.log('Movies Updates:', movies.summary.counters.containsUpdates())
for (const movie of movies) {
  console.log(movie)
}

console.log('People Updates:', people.summary.counters.containsUpdates())
for (const person of people) {
  console.log(person)
}

const titles = await driver.execute(async tx => {
  const result = tx.run('MATCH (m:Movie) RETURN m.title') 
  const titles = []
  for await(const record of result) {
    titles.push(record.get('m.title'))
  }
  return titles
})

const releaseYears = await driver.execute(async tx => {
  const result = tx.run(getMovies.query, getMovies.parameters) 
  const years = []
  for await(const record of result) {
    years.push(record.get('m').properties['released'])
  }
  return years
}, { mode: 'READ' })

console.log(releaseYears)

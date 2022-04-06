import neo4j from 'neo4j-driver-lite'

const driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j','pass'));

const matchAllNodes = await driver.plan('MATCH (n) RETURN n')

for await(const record of await driver.execute(matchAllNodes)) {
  console.log(record.get('n').properties);
}

const createPerson = await driver.plan('CREATE (n:Person {name: $name, born: $born}) RETURN n')

const createPersonResult = await driver.execute(createPerson, { name: 'Antonio', born: 1999n})
console.log('Person created', createPersonResult.sumamry)

// Should print the property of all nodes in the driver as in the first matchAllNodes query
for await(const record of await driver.execute(matchAllNodes, {}, record => record.get('n').properties)) {
  console.log(record);
}

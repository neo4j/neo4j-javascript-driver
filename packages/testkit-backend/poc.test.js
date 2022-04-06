import neo4j from 'neo4j-driver-lite'

const driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j','pass'));
for await(const record of driver.run('MATCH (n) RETURN n', {}, { fetchSize: 10, defaultAccessMode: neo4j.session.READ })) {
  console.log(record.get('n').properties);
}


var neo4j = require('../build/node/neo4j');

var statement = ['MERGE (alice:Person {name:{name_a},age:{age_a}})',
  'MERGE (bob:Person {name:{name_b},age:{age_b}})',
  'CREATE UNIQUE (alice)-[alice_knows_bob:KNOWS]->(bob)',
  'RETURN alice, bob, alice_knows_bob'
];

var params = {
  name_a: 'Alice',
  age_a: 33,
  name_b: 'Bob',
  age_b: 44
};

var driver = neo4j.driver("neo4j://localhost");

var streamSession = driver.session();
var streamResult = streamSession.run(statement.join(' '), params);
streamResult.subscribe({
  onNext: function(record) {
    // On receipt of RECORD
    for(var i in record) {
      console.log(i);
      console.log(record[i]);
    }
  }, onCompleted: function() {
    var summary = streamResult.summarize();
    //Print number of nodes created
    console.log('');
    console.log(summary.updateStatistics().nodesCreated());
    streamSession.close();
  }, onError: function(error) {
    console.log(error);
  }
});

var promiseSession = driver.session();
var promiseResult = promiseSession.run(statement.join(' '), params);
promiseResult.then(function(records) {
  records.forEach(function(record) {
    for(var i in record) {
      console.log(i);
      console.log(record[i]);
    }
  });
  var summary = promiseResult.summarize();
  //Print number of nodes created
  console.log('');
  console.log(summary.updateStatistics().nodesCreated());
})
.catch(function(error) {
  console.log(error);
})
.then(function(){
  promiseSession.close();
});

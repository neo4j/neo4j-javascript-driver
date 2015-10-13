
var neo4j = require('../build/node/neo4j');

var statement = ['MERGE (alice:Person {name:{name_a},age:{age_a}})',
	'MERGE (bob:Person {name:{name_b},age:{age_b}})',
	'CREATE UNIQUE (alice)-[alice_knows_bob:KNOWS]->(bob)',
	'RETURN alice AS xxx, bob, alice_knows_bob'
];

var params = {
	name_a: 'Alice',
	age_a: 33,
	name_b: 'Bob',
	age_b: 44
};

var driver = neo4j.driver("neo4j://localhost");
var session = driver.session();

session.run(statement.join(' '), params).subscribe({
    onNext: function(record) {
        // On receipt of RECORD
        for(var i in record) {
        	console.log(i);
        	console.log(record[i]);
        }
    }, onCompleted: function(metadata) {
        // On receipt of header summary message
        console.log('');
        console.log(metadata);
    }, onError: function(error) {
    	console.log(error);
    }
});

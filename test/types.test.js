
var neo4j = require("../build/node/neo4j");

describe('floating point values', function() {
  it('should support float 1.0 ', testVal( 1 ) );
  it('should support float 0.0 ', testVal( 0.0 ) );
  it('should support pretty big float ', testVal( 3.4028235e+38 ) ); // Max 32-bit 
  it('should support really big float ', testVal( 1.7976931348623157e+308 ) ); // Max 64-bit
  it('should support pretty small float ', testVal( 1.4e-45 ) ); // Min 32-bit
  it('should support really small float ', testVal( 4.9e-324 ) ); // Min 64-bit
});

describe('boolean values', function() {
  it('should support true ',  testVal( true ) );
  it('should support false ', testVal( false ) );
});

describe('string values', function() {
  it('should support empty string ',   testVal( "" ) );
  it('should support simple string ',  testVal( "abcdefghijklmnopqrstuvwxyz" ) );
  it('should support awesome string ', testVal( "All makt åt Tengil, vår befriare." ) );
});

describe('list values', function() {
  it('should support empty lists ',   testVal( [] ) );
  it('should support float lists ',   testVal( [ 1,2,3 ] ) );
  it('should support boolean lists ', testVal( [ true, false ] ) );
  it('should support string lists ',  testVal( [ "", "hello!" ] ) );
  it('should support list lists ',    testVal( [ [], [1,2,3] ] ) );
  it('should support map lists ',     testVal( [ {}, {a:12} ] ) );
});

describe('map values', function() {
  it('should support empty maps ', testVal( {} ) );
  it('should support basic maps ', testVal( {a:1, b:{}, c:[], d:{e:1}} ) );
});

describe('node values', function() {
  it('should support returning node objects', function(done) {
    // Given
    var driver = neo4j.driver("neo4j://localhost");
    var session = driver.session();
    
    // When
    session.run("CREATE (n:User {name:'Lisa'}) RETURN n, id(n)").then(function(rs) {
        var node = rs[0]['n'];

        expect( node.properties ).toEqual( { name:"Lisa" } );
        expect( node.labels ).toEqual( ["User"] );
        // expect( node.identity ).toEqual( rs[0]['id(n)'] ); // TODO
        driver.close(); 
        done();

      });
  });
});

describe('relationship values', function() {
  it('should support returning relationship objects', function(done) {
    // Given
    var driver = neo4j.driver("neo4j://localhost");
    var session = driver.session();
    
    // When
    session.run("CREATE ()-[r:User {name:'Lisa'}]->() RETURN r, id(r)").then(function(rs) {
        var rel = rs[0]['r'];

        expect( rel.properties ).toEqual( { name:"Lisa" } );
        expect( rel.type ).toEqual( "User" );
        // expect( rel.identity ).toEqual( rs[0]['id(r)'] ); // TODO
        driver.close(); 
        done();

      });
  });
});

function testVal( val ) { 
  return function( done ) {
    var driver = neo4j.driver("neo4j://localhost");
    var session = driver.session();

    session.run("RETURN {val} as v", {val: val})
      .then( function( records ) { 
        expect( records[0]['v'] ).toEqual( val ); 
        driver.close();
        done();
      });
  }
}
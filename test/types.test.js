
var neo4j = require("../build/node/neo4j");

describe('the type system', function() {
  it('should support float 1 ',   testVal( 1 ) );
  it('should support float 1.1 ', testVal( 1.1 ) );
  it('should support float 2.1 ', testVal( 2.1 ) );

  function testVal( val ) { 
    return function( done ) {
      neo4j.driver("neo4j://localhost").session()
        .run("RETURN {val} as v", {val: val})
        .then( function( records ) { expect( records[0]['v'] ).toBe( val ); })
        .then( done );
    }
  }
});
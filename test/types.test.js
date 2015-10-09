
var neo4j = require("../build/node/neo4j");

describe('floating point types', function() {
  it('should support float 1.0 ', testVal( 1 ) );
  it('should support float 0.0 ', testVal( 0.0 ) );
  it('should support pretty big float ', testVal( 3.4028235e+38 ) ); // Max 32-bit 
  it('should support really big float ', testVal( 1.7976931348623157e+308 ) ); // Max 64-bit
  it('should support pretty small float ', testVal( 1.4e-45 ) ); // Min 32-bit
  it('should support really small float ', testVal( 4.9e-324 ) ); // Min 64-bit
});


function testVal( val ) { 
  return function( done ) {
    neo4j.driver("neo4j://localhost").session()
      .run("RETURN {val} as v", {val: val})
      .then( function( records ) { expect( records[0]['v'] ).toBe( val ); })
      .then( done );
  }
}
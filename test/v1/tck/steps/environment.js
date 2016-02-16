var neo4j = require("../../../../lib/v1");

module.exports = function () {

  this.Before(function( scenario, callback ) {
    this.driver = neo4j.driver("bolt://localhost");
    this.session = this.driver.session();
    if (findTag(scenario, '@reset_database')) {
      this.session.run("MATCH (n) DETACH DELETE n").then( function( ) {
          callback();
      });
    }
    callback();
  });

  function findTag(scenario, tag) {
    for (var i in scenario.getTags()) {
      if (scenario.getTags()[i].getName() == tag) {
        return true
      }
    }
    return false;
  }
}

var neo4j = require("../../../../lib/v1");

module.exports = function () {

  var failedScenarios = []

  this.Before("@reset_database", function( scenario, callback ) {
    this.driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));
    this.session = this.driver.session();
    this.session.run("MATCH (n) DETACH DELETE n").then( function( ) {
        callback();
    });
    callback();
  });

  this.Before("~@reset_database", function( scenario, callback ) {
    this.driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));
    this.session = this.driver.session();
    callback();
  });

  this.After(function (scenario, callback) {
    if (!scenario.isSuccessful()) {
      failedScenarios.push(scenario)
    }
    callback();
  });

  this.registerHandler('AfterFeatures', function (event, callback) {
    if (failedScenarios.length) {
      for ( var i = 0; i < failedScenarios.length; i++) {
        console.log("FAILED! Scenario: " + failedScenarios[i].getName());
        console.log("With Exception: " + failedScenarios[i].getException() + "\n");
      }
      return process.exit(2);
    }
    callback();
  });
}

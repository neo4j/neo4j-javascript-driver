var neo4j = require("../../../../lib/v1");
var fs = require("fs");

module.exports = function () {

  var failedScenarios = [];

  this.Before("@reset_database", function( scenario, callback ) {
    this.driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));
    this.session = this.driver.session();
    this.session.run("MATCH (n) DETACH DELETE n").then( function( ) {
        callback();
    });
    callback();
  });

  this.Before("@tls", function( scenario ) {
    this.knownHosts1 = "known_hosts1";
    this.knownHosts2 = "known_hosts2";
    _deleteFile(this.knownHosts1);
    _deleteFile(this.knownHosts2);
  });

  this.Before("~@reset_database", "~@tls", function( scenario, callback ) {
    this.driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));
    this.session = this.driver.session();
    callback();
  });

  this.Before("@equality_test", function( scenario ) {
    this.savedValues = {};
  });

  this.After(function (scenario, callback) {
    if (this.driver) {
      this.driver.close();
    }
    if (!scenario.isSuccessful()) {
      failedScenarios.push(scenario)
    }

    _deleteFile(this.knownHosts1);
    _deleteFile(this.knownHosts2);
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

  function _deleteFile(fname) {
    if (!fname) return;

    try {
      fs.lstatSync(fname);
      fs.unlinkSync(fname);
    }
    catch (e) {
      // ignore
    }
  }
};

var neo4j = require("../../../../lib/v1");
var util = require("./util");
var sharedNeo4j = require("../../../internal/shared-neo4j").default;

var CALLBACK_TIMEOUT = 60 * 1000;

module.exports = function () {

  this.Given(/^a running Neo(\d+)j Database$/, {timeout: CALLBACK_TIMEOUT}, function (ignored, callback) {
    if (this.driver1) this.driver1.close();
    if (this.driver2) this.driver2.close();
    util.changeCertificates('./test/resources/derived.key', './test/resources/derived.cert');
    util.restart();
    callback();
  });

  this.When(/^I connect via a TLS\-enabled transport for the first time for the given hostname and port$/, function (callback) {
    this.driver1 = _connectWithHostFile(this.knownHosts1);
    callback();
  });

  this.Then(/^sessions should simply work$/, {timeout: CALLBACK_TIMEOUT},  function (callback) {
    var self = this;
    var session = self.driver1.session();
    session.run("RETURN 1").then(function (result) {
      session.close();
      _closeDrivers(self.driver1, self.driver2);
      callback();
    }).catch(function (error) {
      _closeDrivers(self.driver1, self.driver2);
      console.log(error);
    });
  });

  this.Given(/^a running Neo(\d+)j Database that I have connected to with a TLS\-enabled transport in the past$/,
    {timeout: CALLBACK_TIMEOUT}, function (arg1, callback) {
      util.changeCertificates('./test/resources/derived.key', './test/resources/derived.cert');
      var self = this;
      util.restart();
      var driver = _connectWithHostFile(self.knownHosts1);
      driver.session().run("RETURN 1").then(function (result) {
        driver.close();
        callback();
      });
    });

  this.When(/^I connect via a TLS\-enabled transport again$/, function (callback) {
    this.driver1 = _connectWithHostFile(this.knownHosts1);
    callback();
  });

  this.Given(/^the database has changed which certificate it uses$/, {timeout: CALLBACK_TIMEOUT}, function (callback) {
    util.changeCertificates('./test/resources/other.key', './test/resources/other.cert');
    util.restart();
    callback();
  });

  this.Then(/^creating sessions should fail$/,  {timeout: CALLBACK_TIMEOUT}, function (callback) {
    var session = this.driver1.session();
    var self = this;
    session.run("RETURN 1")
      .then(function(res) {
        _closeDrivers(self.driver1, self.driver2);
        console.log(res);
      })
      .catch(function (error) {
        self.error = error;
        session.close();
        _closeDrivers(self.driver1, self.driver2);
        callback();
      });
  });

  this.Then(/^I should get a helpful error explaining that the certificate has changed$/, function (string, callback) {

    var expected = "Database encryption certificate has changed, and no longer matches the " +
      "certificate stored for localhost:7687 in `known_hosts1`. As a security precaution, this driver will not " +
      "automatically trust the new certificate, because doing so would allow an attacker to pretend to be the " +
      "Neo4j instance we want to connect to. The certificate provided by the server looks like: [object Object]. " +
      "If you trust that this certificate is valid, simply remove the line starting with localhost:7687 in `known_hosts1`, " +
      "and the driver will update the file with the new certificate. You can configure which file the driver should use " +
      "to store this information by setting `knownHosts` to another path in your driver configuration - " +
      "and you can disable encryption there as well using `encrypted:\"ENCRYPTION_OFF\"`.";

    _closeDrivers(this.driver1, this.driver2);

    if (this.error.message !== expected) {
      callback(new Error("Given and expected results does not match: " + this.error.message + " Expected " + expected));
    } else {
      callback();
    }
  });

  this.Given(/^two drivers$/, function (callback) {
    callback();
  });

  this.When(/^I configure one of them to use a different location for its known hosts storage$/, function (callback) {
    this.driver1 = _connectWithHostFile(this.knownHosts1);
    this.driver2 = _connectWithHostFile(this.knownHosts2);
    callback();
  });

  this.Then(/^the two drivers should not interfere with one another's known hosts files$/, function (callback) {
    var session1 = this.driver1.session();
    var self = this;
    session1.run("RETURN 1").then(function (result) {
      session1.close();
      var session2 = self.driver2.session();
      session2.run("RETURN 1").then(function (result) {
        session2.close();
        _closeDrivers(self.driver1, self.driver2);
        callback();
      });
    });
  });

  this.Given(/^a driver configured to use a trusted certificate$/, function (callback) {
    this.config = {
      encrypted: "ENCRYPTION_ON",
      trust: "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES",
      knownHosts: this.knownHosts1,
      trustedCertificates: ['./test/resources/root.cert']
    };

    callback();
  });

  this.Given(/^a running Neo(\d+)j Database using a certificate signed by the same trusted certificate$/,
    {timeout: CALLBACK_TIMEOUT}, function (arg1, callback) {
      util.changeCertificates('./test/resources/derived.key', './test/resources/derived.cert');
      util.restart();
      callback();
    });

  this.When(/^I connect via a TLS\-enabled transport$/, function (callback) {
    this.driver1 = neo4j.driver("bolt://localhost", neo4j.auth.basic(sharedNeo4j.username, sharedNeo4j.password), this.config);
    callback();
  });

  this.Given(/^a running Neo(\d+)j Database using that exact trusted certificate$/, {timeout: CALLBACK_TIMEOUT}, function (arg1, callback) {
    //will have to hack a little bit here since the root cert cannot be used by the server since its
    //common name is not set to localhost
    this.config = {
      encrypted: "ENCRYPTION_ON",
      trust: "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES",
      knownHosts: this.knownHosts1,
      trustedCertificates: [util.neo4jCert]
    };

    util.changeCertificates('./test/resources/other.key', './test/resources/other.cert');
    util.restart();
    callback();
  });

  this.Given(/^a running Neo(\d+)j Database using a certificate not signed by the trusted certificate$/, {timeout: CALLBACK_TIMEOUT},
    function (arg1, callback) {
      util.changeCertificates('./test/resources/other.key', './test/resources/other.cert');
      util.restart();
      callback();
    });

  this.Then(/^I should get a helpful error explaining that no trusted certificate found$/, function (callback) {
    var expected = "Server certificate is not trusted. If you trust the database you are connecting to, add the signing " +
      "certificate, or the server certificate, to the list of certificates trusted by this driver using " +
      "`neo4j.v1.driver(.., { trustedCertificates:['path/to/certificate.crt']}). This  is a security measure to protect " +
      "against man-in-the-middle attacks. If you are just trying  Neo4j out and are not concerned about encryption, " +
      "simply disable it using `encrypted=\"ENCRYPTION_OFF\"` in the driver options. Socket responded with: DEPTH_ZERO_SELF_SIGNED_CERT";

    _closeDrivers(this.driver1, this.driver2);

    if (this.error.message !== expected) {
      callback(new Error("Given and expected results does not match: " + this.error.message + " Expected " + expected));
    } else {
      callback();
    }
  });

  function _connectWithHostFile(hostFile) {
    return neo4j.driver("bolt://localhost", neo4j.auth.basic(sharedNeo4j.username, sharedNeo4j.password), {
      trust: "TRUST_ON_FIRST_USE",
      knownHosts: hostFile,
      encrypted: "ENCRYPTION_ON"
    });
  }

  function _closeDrivers() {
    for (var i = 0; i < arguments.length; i++) {
      var driver = arguments[i];
      if (driver) {
        driver.close();
      }
    }
  }
};

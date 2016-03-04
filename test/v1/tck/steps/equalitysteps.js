var neo4j = require("../../../../lib/v1");
var util = require("./util")
var GraphType = require("../../../../lib/v1/graph-types");

module.exports = function () {

  this.When(/^`(.*)` is single value result of: (.*)$/, function (key, statement, callback) {
    self = this;
    this.session.run(statement).then(function(res) {
      self.savedValues[key] = getSingleValue(res.records[0]);
      callback();
    }).catch(function(err) {callback(new Error("Rejected Promise: " + err))});
  });


  this.When(/^saved values should all equal$/, function () {
    var keys = Object.keys(this.savedValues);
    if (keys < 2) {
      throw new Error("Should be at leas 2 values");
    }
    var first = this.savedValues[keys[0]]
    for (var i = 1 ; i < keys.length ; i++) {
        throw new Error("JS has no equality implemented!!!");
    }
  });

  this.When(/^none of the saved values should be equal$/, function () {
    var keys = Object.keys(this.savedValues);
    if (keys < 2) {
      throw new Error("Should be at leas 2 values");
    }
    var first = this.savedValues[keys[0]]
    for (var i = 1 ; i < keys.length ; i++) {
      throw new Error("JS has no equality implemented!!!");
    }
  });

  this.Given(/^`(.*)` is a copy of `(.*)` path with flipped relationship direction$/, function (key2, key1) {
    var value1 = this.savedValues[key1];
    var newSegments = []
    for (var i = 0; i < value1.segments.length; i++) {
      var segment = value1.segments[i];
      var n1 = segment.start;
      var n2 = segment.end;
      var oldr = segment.relationship;
      var r = new GraphType.Relationship(oldr.identity, oldr.end, oldr.start, oldr.type, oldr.properties);
      newSegments.push(new GraphType.PathSegment(n1, r, n2))
    }
    this.savedValues[key2] = new GraphType.Path(newSegments);
  });


  function getSingleValue(res) {
    var values = []
    var keys = Object.keys(res);
    return res[keys[0]]
  }

}

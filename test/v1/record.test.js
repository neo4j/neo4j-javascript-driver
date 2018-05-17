/**
 * Copyright (c) 2002-2018 "Neo4j,"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var Record = require("../../lib/v1/record").default;
var Neo4jError = require("../../lib/v1/error").Neo4jError;


describe('Record', function() {
  it('should allow getting fields by name', function() {
    // Given
    var record = new Record( ["name"], ["Bob"] );

    // When & Then
    expect(record.get("name")).toEqual("Bob");
  });

  it('should allow checking if fields exist', function() {
    // Given
    var record = new Record( ["name"], ["Bob"] );

    // When & Then
    expect(record.has("name")).toEqual(true);
    expect(record.has("invalid key")).toEqual(false);
    expect(record.has(0)).toEqual(true);
    expect(record.has(1)).toEqual(false);
  });

  it('should transform Record into Object', function() {
    // Given
    var record = new Record( ["name", "age", "nested"], ["Bob", 20.5, {test: true}] );

    // When
    var obj = record.toObject();

    // Then
    expect(obj.name).toEqual("Bob");
    expect(obj.age).toEqual(20.5);
    expect(obj.nested.test).toEqual(true);
  });

  it('should give helpful error on no such key', function() {
    // Given
    var record = new Record( ["name"], ["Bob"] );

    // When & Then
    expect( function() { record.get("age") }).toThrow(new Neo4jError(
      "This record has no field with key 'age', available key are: [name]."));
  });

  it('should allow getting fields by index', function() {
    // Given
    var record = new Record( ["name"], ["Bob"] );

    // When & Then
    expect(record.get(0)).toEqual("Bob");
  });

  it('should give helpful error on no such index', function() {
    // Given
    var record = new Record( ["name"], ["Bob"] );

    // When & Then
    expect( function() { record.get(1) }).toThrow(new Neo4jError(
      "This record has no field with index '1'. Remember that indexes start at `0`, " +
      "and make sure your statement returns records in the shape you meant it to."));
  });

  it('should have length', function() {
    // When & Then
    expect( new Record( [], []).length ).toBe(0);
    expect( new Record( ["name"], ["Bob"]).length ).toBe(1);
    expect( new Record( ["name", "age"], ["Bob", 45]).length ).toBe(2);
  });

  it('should allow forEach through the record', function() {
    // Given
    var record = new Record( ["name", "age"], ["Bob", 45] );
    var result = [];

    // When
    record.forEach( function( value, key, record ) {
      result.push( [value, key, record] );
    });

    // Then
    expect(result).toEqual([["Bob", "name", record], [45, "age", record]]);
  });
});

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

import {isInt} from '../../integer';
import {Node, Path, PathSegment, Relationship} from '../../graph-types';
import {Neo4jError, PROTOCOL_ERROR} from '../../error';
import {isPoint, Point} from '../../spatial-types';
import {isDate, isDateTime, isDuration, isLocalDateTime, isLocalTime, isTime} from '../../temporal-types';

const CREDENTIALS_EXPIRED_CODE = 'Neo.ClientError.Security.CredentialsExpired';

export default class HttpResponseConverter {

  encodeStatementParameters(parameters) {
    return encodeQueryParameters(parameters);
  }

  /**
   * Attempts to extract error from transactional cypher endpoint response and convert it to {@link Neo4jError}.
   * @param {object} response the response.
   * @return {Neo4jError|null} new driver friendly error, if exists.
   */
  extractError(response) {
    const errors = response.errors;
    if (errors) {
      const error = errors[0];
      if (error) {
        // endpoint returns 'Neo.ClientError.Security.Forbidden' code and 'password_change' that points to another endpoint
        // this is different from code returned via Bolt and less descriptive
        // make code same as in Bolt, if password change is required
        const code = response.password_change ? CREDENTIALS_EXPIRED_CODE : error.code;
        const message = error.message;
        return new Neo4jError(message, code);
      }
    }
    return null;
  }

  /**
   * Extracts transaction id from the db/data/transaction endpoint response.
   * @param {object} response the response.
   * @return {number} the transaction id.
   */
  extractTransactionId(response) {
    const commitUrl = response.commit;
    if (commitUrl) {
      // extract id 42 from commit url like 'http://localhost:7474/db/data/transaction/42/commit'
      const url = commitUrl.replace('/commit', '');
      const transactionIdString = url.substring(url.lastIndexOf('/') + 1);
      const transactionId = parseInt(transactionIdString, 10);
      if (transactionId || transactionId === 0) {
        return transactionId;
      }
    }
    throw new Neo4jError(`Unable to extract transaction id from the response JSON: ${JSON.stringify(response)}`);
  }

  /**
   * Extracts record metadata (array of column names) from transactional cypher endpoint response.
   * @param {object} response the response.
   * @return {object} new metadata object.
   */
  extractRecordMetadata(response) {
    const result = extractResult(response);
    const fields = result ? result.columns : [];
    return {fields: fields};
  }

  /**
   * Extracts raw records (each raw record is just an array of value) from transactional cypher endpoint response.
   * @param {object} response the response.
   * @return {object[][]} raw records from the response.
   */
  extractRawRecords(response) {
    const result = extractResult(response);
    if (result) {
      const data = result.data;
      if (data) {
        return data.map(element => extractRawRecord(element));
      }
    }
    return [];
  }

  /**
   * Extracts metadata for a completed statement.
   * @param {object} response the response.
   * @return {object} metadata as object.
   */
  extractStatementMetadata(response) {
    const result = extractResult(response);
    if (result) {
      const stats = result.stats;
      if (stats) {
        const convertedStats = Object.keys(stats).reduce((newStats, key) => {
          if (key === 'contains_updates') {
            // skip because such key does not exist in bolt
            return newStats;
          }

          // fix key name for future parsing by StatementStatistics class
          const newKey = (key === 'relationship_deleted' ? 'relationships_deleted' : key).replace('_', '-');
          newStats[newKey] = stats[key];
          return newStats;
        }, {});

        return {stats: convertedStats};
      }
    }
    return {};
  }
}

function encodeQueryParameters(parameters) {
  if (parameters && typeof parameters === 'object') {
    return Object.keys(parameters).reduce((result, key) => {
      result[key] = encodeQueryParameter(parameters[key]);
      return result;
    }, {});
  }
  return parameters;
}

function encodeQueryParameter(value) {
  if (value instanceof Node) {
    throw new Neo4jError('It is not allowed to pass nodes in query parameters', PROTOCOL_ERROR);
  } else if (value instanceof Relationship) {
    throw new Neo4jError('It is not allowed to pass relationships in query parameters', PROTOCOL_ERROR);
  } else if (value instanceof Path) {
    throw new Neo4jError('It is not allowed to pass paths in query parameters', PROTOCOL_ERROR);
  } else if (isPoint(value)) {
    throw newUnsupportedParameterError('points');
  } else if (isDate(value)) {
    throw newUnsupportedParameterError('dates');
  } else if (isDateTime(value)) {
    throw newUnsupportedParameterError('date-time');
  } else if (isDuration(value)) {
    throw newUnsupportedParameterError('durations');
  } else if (isLocalDateTime(value)) {
    throw newUnsupportedParameterError('local date-time');
  } else if (isLocalTime(value)) {
    throw newUnsupportedParameterError('local time');
  } else if (isTime(value)) {
    throw newUnsupportedParameterError('time');
  } else if (isInt(value)) {
    return value.toNumber();
  } else if (Array.isArray(value)) {
    return value.map(element => encodeQueryParameter(element));
  } else if (typeof value === 'object') {
    return encodeQueryParameters(value);
  } else {
    return value;
  }
}

function newUnsupportedParameterError(name) {
  return new Neo4jError(`It is not allowed to pass ${name} in query parameters when using HTTP endpoint. ` +
    `Please consider using Cypher functions to create ${name} so that query parameters are plain objects.`, PROTOCOL_ERROR);
}

function extractResult(response) {
  const results = response.results;
  if (results) {
    const result = results[0];
    if (result) {
      return result;
    }
  }
  return null;
}

function extractRawRecord(data) {
  const row = data.row;

  const nodesById = indexNodesById(data);
  const relationshipsById = indexRelationshipsById(data);

  if (row) {
    return row.map((ignore, index) => extractRawRecordElement(index, data, nodesById, relationshipsById));
  }
  return [];
}

function indexNodesById(data) {
  const graph = data.graph;
  if (graph) {
    const nodes = graph.nodes;
    if (nodes) {
      return nodes.reduce((result, node) => {

        const identity = convertNumber(node.id);
        const labels = node.labels;
        const properties = convertPrimitiveValue(node.properties);
        result[node.id] = new Node(identity, labels, properties);

        return result;
      }, {});
    }
  }
  return {};
}

function indexRelationshipsById(data) {
  const graph = data.graph;
  if (graph) {
    const relationships = graph.relationships;
    if (relationships) {
      return relationships.reduce((result, relationship) => {

        const identity = convertNumber(relationship.id);
        const startNode = convertNumber(relationship.startNode);
        const endNode = convertNumber(relationship.endNode);
        const type = relationship.type;
        const properties = convertPrimitiveValue(relationship.properties);
        result[relationship.id] = new Relationship(identity, startNode, endNode, type, properties);

        return result;

      }, {});
    }
  }
  return {};
}

function extractRawRecordElement(index, data, nodesById, relationshipsById) {
  const element = data.row ? data.row[index] : null;
  const elementMetadata = data.meta ? data.meta[index] : null;

  if (elementMetadata) {
    // element is either a graph, spatial or temporal type
    return convertComplexValue(element, elementMetadata, nodesById, relationshipsById);
  } else {
    // element is a primitive, like number, string, array or object
    return convertPrimitiveValue(element);
  }
}

function convertComplexValue(element, elementMetadata, nodesById, relationshipsById) {
  if (isNodeMetadata(elementMetadata)) {
    return nodesById[elementMetadata.id];
  } else if (isRelationshipMetadata(elementMetadata)) {
    return relationshipsById[elementMetadata.id];
  } else if (isPathMetadata(elementMetadata)) {
    return convertPath(elementMetadata, nodesById, relationshipsById);
  } else if (isPointMetadata(elementMetadata)) {
    return convertPoint(element);
  } else {
    return element;
  }
}

function convertPath(metadata, nodesById, relationshipsById) {
  let startNode = null;
  let relationship = null;
  const pathSegments = [];

  for (let i = 0; i < metadata.length; i++) {
    const element = metadata[i];
    const elementId = element.id;
    const elementType = element.type;

    const nodeExpected = (startNode === null && relationship === null) || (startNode !== null && relationship !== null);
    if (nodeExpected && elementType !== 'node') {
      throw new Neo4jError(`Unable to parse path, node expected but got: ${JSON.stringify(element)} in ${JSON.stringify(metadata)}`);
    }
    if (!nodeExpected && elementType === 'node') {
      throw new Neo4jError(`Unable to parse path, relationship expected but got: ${JSON.stringify(element)} in ${JSON.stringify(metadata)}`);
    }

    if (nodeExpected) {
      const node = nodesById[elementId];
      if (startNode === null) {
        startNode = node;
      } else if (startNode !== null && relationship !== null) {
        const pathSegment = new PathSegment(startNode, relationship, node);
        pathSegments.push(pathSegment);
        startNode = node;
        relationship = null;
      } else {
        throw new Neo4jError(`Unable to parse path, illegal node configuration: ${JSON.stringify(metadata)}`);
      }
    } else {
      if (relationship === null) {
        relationship = relationshipsById[elementId];
      } else {
        throw new Neo4jError(`Unable to parse path, illegal relationship configuration: ${JSON.stringify(metadata)}`);
      }
    }
  }

  const lastPathSegment = pathSegments[pathSegments.length - 1];
  if ((lastPathSegment && lastPathSegment.end !== startNode) || relationship !== null) {
    throw new Neo4jError(`Unable to parse path: ${JSON.stringify(metadata)}`);
  }

  return createPath(pathSegments);
}

function createPath(pathSegments) {
  const pathStartNode = pathSegments[0].start;
  const pathEndNode = pathSegments[pathSegments.length - 1].end;
  return new Path(pathStartNode, pathEndNode, pathSegments);
}

function convertPoint(element) {
  const type = element.type;
  if (type !== 'Point') {
    throw new Neo4jError(`Unexpected Point type received: ${JSON.stringify(element)}`);
  }

  const coordinates = element.coordinates;
  if (!Array.isArray(coordinates) && (coordinates.length !== 2 || coordinates.length !== 3)) {
    throw new Neo4jError(`Unexpected Point coordinates received: ${JSON.stringify(element)}`);
  }

  const srid = convertCrsToId(element);

  return new Point(srid, ...coordinates);
}

function convertCrsToId(element) {
  const crs = element.crs;
  if (!crs || !crs.name) {
    throw new Neo4jError(`Unexpected Point crs received: ${JSON.stringify(element)}`);
  }
  const name = crs.name.toLowerCase();

  if (name === 'wgs-84') {
    return 4326;
  } else if (name === 'wgs-84-3d') {
    return 4979;
  } else if (name === 'cartesian') {
    return 7203;
  } else if (name === 'cartesian-3d') {
    return 9157;
  } else {
    throw new Neo4jError(`Unexpected Point crs received: ${JSON.stringify(element)}`);
  }
}

function convertPrimitiveValue(element) {
  if (element == null || element === undefined) {
    return null;
  } else if (typeof element === 'number') {
    return convertNumber(element);
  } else if (Array.isArray(element)) {
    return element.map(element => convertPrimitiveValue(element));
  } else if (typeof element === 'object') {
    return Object.keys(element).reduce((result, key) => {
      result[key] = convertPrimitiveValue(element[key]);
      return result;
    }, {});
  } else {
    return element;
  }
}

function convertNumber(value) {
  return typeof value === 'number' ? value : Number(value);
}

function isNodeMetadata(metadata) {
  return isMetadataForType('node', metadata);
}

function isRelationshipMetadata(metadata) {
  return isMetadataForType('relationship', metadata);
}

function isPointMetadata(metadata) {
  return isMetadataForType('point', metadata);
}

function isMetadataForType(name, metadata) {
  return !Array.isArray(metadata) && typeof metadata === 'object' && metadata.type === name;
}

function isPathMetadata(metadata) {
  return Array.isArray(metadata);
}

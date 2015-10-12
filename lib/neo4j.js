/*
 * Copyright (c) 2002-2015 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
 *
 * This file is part of Neo4j.
 *
 * Neo4j is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {int} from "./internal/integer";
import {connect} from "./internal/connector";
import {debug} from "./internal/log";

let USER_AGENT = "neo4j-javascript/0.0";


class Node {
  constructor(identity, labels, properties) {
    this.identity = identity;
    this.labels = labels;
    this.properties = properties;
  }

  toString() {
    let s = "(" + this.identity.split('/')[1];
    for (let i = 0; i < this.labels.length; i++) {
      s += ":" + labels[i];
    }
    let keys = Object.keys(this.properties);
    if (keys.length > 0) {
      s += " {";
      for(let i = 0; i < keys.length; i++) {
        if (i > 0) s += ",";
        s += keys[i] + ":" + JSON.stringify(this.properties[keys[i]]);
      }
      s += "}";
    }
    s += ")";
    return s;
  }
}

class Relationship {
  constructor(identity, start, end, type, properties) {
    this.identity = identity;
    this.start = start;
    this.end = end;
    this.type = type;
    this.properties = properties;
  }

  toString() {
    let s = "(" + this.start.split('/')[1] + ")-[:" + this.type;
    let keys = Object.keys(this.properties);
    if (keys.length > 0) {
      s += " {";
      for(let i = 0; i < keys.length; i++) {
        if (i > 0) s += ",";
        s += keys[i] + ":" + JSON.stringify(this.properties[keys[i]]);
      }
      s += "}";
    }
    s += "]->(" + this.end.split('/')[1] + ")";
    return s;
  }
}

class PathSegment {
  constructor( start, rel, end ) {
    this.start = start;
    this.relationship = rel;
    this.end = end;
  }
}

class Path {
  constructor(segments) {
    this.segments = segments;
    this.start = segments[0].start;
    this.end = segments[segments.length - 1].end;
    this.length = segments.length;
  }
}

/** 
 * Handles a RUN/PULL_ALL, or RUN/DISCARD_ALL requests, maps the responses
 * in a way that a user-provided observer can see these as a clean Stream
 * of records.
 */
class StreamObserver {
  constructor() {
    // This class will queue up incoming messages until a user-provided observer
    // for the incoming stream is registered. Thus, we keep fields around
    // for tracking head/records/tail. These are only used if there is no
    // observer registered.
    this._head = null;
    this._queuedRecords = [];
    this._tail = null;
    this._error = null;
  }

  onNext(rawRecord) {
    let record = {};
    for (var i = 0; i < this._head.length; i++) {
      record[this._head[i]] = rawRecord[i];
    };

    if( this._observer ) {
      this._observer.onNext( record );
    } else {
      this._queuedRecords.push( record );
    }
  }

  onCompleted(meta) {
    if( this._head === null ) {
      // Stream header
      this._head = meta.fields;
    } else {
      // End of stream
      if( this._observer ) {
        this._observer.onCompleted( meta );
      } else {
        this._tail = meta;
      }
    }
  }

  onError(error) {
    if( this._observer ) {
      this._observer.onError( error );
    } else {
      this._error = error;
    }
  }

  subscribe( observer ) {
    if( this._error ) {
      observer.onError(this._error);
      return;
    }

    if( this._queuedRecords.length > 0 ) {
      for (var i = 0; i < _queuedRecords.length; i++) {
        observer.onNext( _queuedRecords[i] );
      };
    }

    if( this._tail ) {
      observer.onCompleted( this._tail );
    }

    this._observer = observer;
  }
}

class Result {
  constructor(streamObserver) {
    this._streamObserver = streamObserver;
    this.p = null;
  }
  createPromise() {
    if(this.p) {
      return;
    }
    let self = this;
    this.p = new Promise((resolve, reject) => {
      let records = [];
      let observer = {
        onNext: (record) => { records.push(record); },
        onCompleted: () => { resolve(records); },
        onError: (error) => { reject(error); }
      }
      self.subscribe(observer);
    });
  }
  catch(cb) {
    this.createPromise();
    this.p.catch(cb);
    return this.p;
  }
  then(cb) {
    this.createPromise();
    this.p.then(cb);
    return this.p;
  }
  subscribe(observer) {
    this._streamObserver.subscribe(observer);
  }
}

class Session {
  constructor( conn, onClose ) {
    this._conn = conn;
    this._onClose = onClose;
  }

  run(statement, params) {
    let streamObserver = new StreamObserver();
    this._conn.run( statement, params || {}, streamObserver );
    this._conn.pullAll( streamObserver );
    this._conn.sync();
    return new Result( streamObserver );
  }

  close(cb) {
    this._onClose();
    this._conn.close(cb);
  }
}

class Driver {
  constructor(url) {
    this._url = url;
    this._openSessions = {};
    this._sessionIdGenerator = 0;
  }

  session() {
    var sessionId = this._sessionIdGenerator++,
        conn = connect(this._url);
    conn.initialize(USER_AGENT);

    var driver = this;
    var session = new Session( conn, () => {
      // On close of session, remove it from the list of open sessions
      delete driver._openSessions[sessionId]; 
    });

    this._openSessions[sessionId] = session;
    return session;
  }

  close() {
    for (var sessionId in this._openSessions) {
      if (this._openSessions.hasOwnProperty(sessionId)) {
        this._openSessions[sessionId].close();
      }
    }
  }
}

function driver(url) {
  return new Driver( url );
}

// Expose public classes
export default {
    Session,
    Node,
    Relationship,
    Path,
    PathSegment,
    driver,
    int
};
